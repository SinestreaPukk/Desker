/**
 * OAuth for connectors: the owner clicks Connect, approves on the provider's
 * own page, and comes back connected - no API key to find or paste.
 *
 * Each provider asks for the least it needs (see SCOPES). Tokens are sealed
 * with the vault key the moment they arrive and opened only in
 * `connectorAccess`, which also refreshes them when they are about to expire.
 * The `state` round trip is signed and bound to the browser that started it,
 * so a callback cannot be replayed into someone else's organisation.
 */
import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { open, seal } from "@/lib/auth/vault";
import { connectorById, type OAuthProvider } from "./catalog";

interface ProviderSpec {
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizeUrl: (clientId: string) => string;
  tokenUrl: string;
  /** Space- or comma-separated as the provider expects, already joined. */
  scope: string;
  scopeParam: string;
  extraParams?: Record<string, string>;
  /** Meta documents its code exchange as a GET with the parameters in the query. */
  tokenMethod?: "GET" | "POST";
  /** How the token endpoint wants the app's secret: in the form (most) or as HTTP Basic (X). */
  tokenAuth?: "body" | "basic";
  /** Proof Key for Code Exchange, which X requires. */
  pkce?: boolean;
  /** Turns the first token into the one kept - a long-lived one, and what posting needs later. */
  finish?: (tokens: ConnectorTokens, data: Record<string, unknown>) => Promise<{ tokens: ConnectorTokens; account: string }>;
  /** A refresh that isn't the standard refresh_token grant (Threads). */
  refresh?: (tokens: ConnectorTokens) => Promise<ConnectorTokens>;
}

/** Graph API versions stay available for two years; bump before this one is retired. */
export const META_GRAPH = "https://graph.facebook.com/v23.0";
export const THREADS_GRAPH = "https://graph.threads.net/v1.0";

async function getJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", ...init?.headers } });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as { message?: string } | string | undefined;
    throw new Error(typeof error === "string" ? error : (error?.message ?? `HTTP ${response.status}`));
  }
  return data;
}

const secretOf = (spec: ProviderSpec) => process.env[spec.clientSecretEnv]!.trim();
const idOf = (spec: ProviderSpec) => process.env[spec.clientIdEnv]!.trim();

/**
 * The least each provider needs:
 * - Google: events on the owner's calendars, plus their address to label the
 *   connection. Not Gmail, not Drive, not account settings.
 * - Slack: post as the app, and list channels so the agent can name one. It
 *   can only post where it has been invited, and cannot read messages.
 * - GitHub: a GitHub App the owner installs on the repositories they pick,
 *   with read-only contents, issues and pull requests (set on the app itself).
 * - Microsoft: Outlook mail and calendar through Graph, per connector.
 *
 * Google and Microsoft each back two connectors (mail, calendar); each
 * connector asks only for its own scopes (Connector.scope in the catalog).
 */
const PROVIDERS: Record<OAuthProvider, ProviderSpec> = {
  google: {
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: () => "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email https://www.googleapis.com/auth/calendar.events",
    scopeParam: "scope",
    // offline + consent: a refresh token, so the connection outlives the hour.
    extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "false" },
  },
  microsoft: {
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    // "common": work and school accounts and personal Outlook.com alike.
    authorizeUrl: () => "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access openid email User.Read",
    scopeParam: "scope",
    extraParams: { prompt: "select_account" },
  },
  slack: {
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    authorizeUrl: () => "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scope: "chat:write,channels:read,channels:history,im:history",
    scopeParam: "scope",
  },
  github: {
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    // Installing the app is where the owner picks repositories; without a
    // slug configured, plain user authorisation of the same app.
    authorizeUrl: () => {
      const slug = process.env.GITHUB_APP_SLUG?.trim();
      return slug
        ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`
        : "https://github.com/login/oauth/authorize";
    },
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "",
    scopeParam: "scope",
  },
  // Post as the member ("Share on LinkedIn", self-serve). Tokens last 60 days
  // and can't be refreshed outside LinkedIn's partner programme: reconnect then.
  linkedin: {
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    authorizeUrl: () => "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile email w_member_social",
    scopeParam: "scope",
    finish: async (tokens) => {
      const me = await getJson("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${tokens.accessToken}` } });
      return {
        tokens: { ...tokens, extra: { personId: String(me.sub ?? "") } },
        account: String(me.name ?? me.email ?? "LinkedIn member"),
      };
    },
  },
  // Pages the owner picks on Facebook's own screen, and the Instagram business
  // accounts linked to them. Page tokens from a long-lived user token don't
  // expire, so those are what is kept.
  meta: {
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    authorizeUrl: () => "https://www.facebook.com/v23.0/dialog/oauth",
    tokenUrl: `${META_GRAPH}/oauth/access_token`,
    tokenMethod: "GET",
    scope:
      "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,instagram_manage_insights,business_management",
    scopeParam: "scope",
    finish: async (tokens) => {
      const spec = PROVIDERS.meta;
      const long = await getJson(
        `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: idOf(spec),
          client_secret: secretOf(spec),
          fb_exchange_token: tokens.accessToken,
        })}`,
      );
      const userToken = String(long.access_token ?? tokens.accessToken);
      const accounts = await getJson(
        `${META_GRAPH}/me/accounts?${new URLSearchParams({
          fields: "id,name,access_token,instagram_business_account{id,username}",
          limit: "50",
          access_token: userToken,
        })}`,
      );
      const pages = ((accounts.data as Array<Record<string, unknown>> | undefined) ?? []).map((page) => {
        const ig = page.instagram_business_account as { id?: string; username?: string } | undefined;
        return {
          id: String(page.id),
          name: String(page.name ?? "Page"),
          token: String(page.access_token ?? ""),
          instagram: ig?.id ? { id: ig.id, username: ig.username ?? "" } : null,
        };
      });
      if (pages.length === 0) throw new Error("No Facebook Page was shared. Connect again and tick at least one Page.");
      const names = pages.map((page) => page.name + (page.instagram ? ` + @${page.instagram.username}` : ""));
      // No expiry: the page tokens kept here don't expire.
      return { tokens: { accessToken: userToken, extra: { pages } }, account: names.join(", ") };
    },
  },
  x: {
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    authorizeUrl: () => "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scope: "tweet.read tweet.write users.read offline.access",
    scopeParam: "scope",
    tokenAuth: "basic",
    pkce: true,
    finish: async (tokens) => {
      const me = await getJson("https://api.x.com/2/users/me", { headers: { authorization: `Bearer ${tokens.accessToken}` } });
      const user = (me.data as { id?: string; username?: string } | undefined) ?? {};
      return { tokens: { ...tokens, extra: { userId: user.id ?? "" } }, account: user.username ? `@${user.username}` : "X account" };
    },
  },
  // Short-lived code token, swapped for a 60-day one that refreshes itself.
  threads: {
    clientIdEnv: "THREADS_APP_ID",
    clientSecretEnv: "THREADS_APP_SECRET",
    authorizeUrl: () => "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scope: "threads_basic,threads_content_publish,threads_read_replies,threads_manage_replies",
    scopeParam: "scope",
    finish: async (tokens, data) => {
      const long = await getJson(
        `https://graph.threads.net/access_token?${new URLSearchParams({
          grant_type: "th_exchange_token",
          client_secret: secretOf(PROVIDERS.threads),
          access_token: tokens.accessToken,
        })}`,
      );
      const kept = toTokens(long);
      const me = await getJson(`${THREADS_GRAPH}/me?${new URLSearchParams({ fields: "id,username", access_token: kept.accessToken })}`);
      return {
        tokens: { ...kept, extra: { userId: String(me.id ?? data.user_id ?? "") } },
        account: me.username ? `@${String(me.username)}` : "Threads profile",
      };
    },
    refresh: async (tokens) => {
      const data = await getJson(
        `https://graph.threads.net/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: tokens.accessToken })}`,
      );
      return { ...toTokens(data), extra: tokens.extra };
    },
  },
};

export function oauthConfigured(provider: OAuthProvider): boolean {
  const spec = PROVIDERS[provider];
  return Boolean(process.env[spec.clientIdEnv]?.trim() && process.env[spec.clientSecretEnv]?.trim());
}

// --- state ------------------------------------------------------------------

interface OAuthState {
  organizationId: string;
  userId: string;
  connectorId: string;
  /** Where to send the owner afterwards: a path inside the app. */
  returnTo: string;
  nonce: string;
  exp: number;
}

function stateKey(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return secret;
}

export function signState(state: Omit<OAuthState, "nonce" | "exp">): { token: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...state, nonce, exp: Date.now() + 10 * 60_000 } satisfies OAuthState),
  ).toString("base64url");
  const mac = createHmac("sha256", stateKey()).update(body).digest("base64url");
  return { token: `${body}.${mac}`, nonce };
}

/** Null for anything tampered with, expired, or not started in this browser. */
export function verifyState(token: string, cookieNonce: string | undefined): OAuthState | null {
  const [body, mac] = token.split(".");
  if (!body || !mac || !cookieNonce) return null;
  const expected = createHmac("sha256", stateKey()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
  if (state.exp < Date.now() || state.nonce !== cookieNonce) return null;
  // Only ever back into the app: a state can never carry an off-site redirect.
  if (!state.returnTo.startsWith("/") || state.returnTo.startsWith("//")) return null;
  return state;
}

// --- the round trip -----------------------------------------------------------

/** X's PKCE pair: the verifier stays in a cookie, the challenge goes to the provider. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function usesPkce(provider: OAuthProvider): boolean {
  return Boolean(PROVIDERS[provider].pkce);
}

export function authorizeUrl(
  provider: OAuthProvider,
  redirectUri: string,
  stateToken: string,
  scope?: string,
  codeChallenge?: string,
): string {
  const spec = PROVIDERS[provider];
  const url = new URL(spec.authorizeUrl(process.env[spec.clientIdEnv]!.trim()));
  url.searchParams.set("client_id", process.env[spec.clientIdEnv]!.trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", stateToken);
  url.searchParams.set("response_type", "code");
  const scopes = scope ?? spec.scope;
  if (scopes) url.searchParams.set(spec.scopeParam, scopes);
  for (const [key, value] of Object.entries(spec.extraParams ?? {})) url.searchParams.set(key, value);
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

interface ConnectorTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms; absent when the token does not expire. */
  expiresAt?: number;
  /** What a provider needs besides the token: LinkedIn's member id, Meta's Page tokens. Sealed with the rest. */
  extra?: Record<string, unknown>;
}

async function tokenRequest(provider: OAuthProvider, params: Record<string, string>) {
  const spec = PROVIDERS[provider];
  const basic = spec.tokenAuth === "basic";
  const form = new URLSearchParams({
    client_id: idOf(spec),
    ...(basic ? {} : { client_secret: secretOf(spec) }),
    ...params,
  });
  const auth: Record<string, string> = basic
    ? { authorization: `Basic ${Buffer.from(`${idOf(spec)}:${secretOf(spec)}`).toString("base64")}` }
    : {};
  const response =
    spec.tokenMethod === "GET"
      ? await fetch(`${spec.tokenUrl}?${form}`, { headers: { accept: "application/json", ...auth } })
      : await fetch(spec.tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...auth },
          body: form,
        });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // Slack answers 200 with ok:false; GitHub answers 200 with an error field.
  if (!response.ok || data.ok === false || data.error) {
    throw new Error(`The provider refused the connection (${String(data.error ?? response.status)}).`);
  }
  return data;
}

function toTokens(data: Record<string, unknown>): ConnectorTokens {
  const accessToken = String(data.access_token ?? "");
  if (!accessToken) throw new Error("The provider did not return an access token.");
  const expiresIn = Number(data.expires_in ?? 0);
  return {
    accessToken,
    ...(data.refresh_token ? { refreshToken: String(data.refresh_token) } : {}),
    ...(expiresIn > 0 ? { expiresAt: Date.now() + expiresIn * 1000 } : {}),
  };
}

/** Exchanges the callback's code, and names the account so the owner can tell connections apart. */
export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<{ tokens: ConnectorTokens; account: string }> {
  const data = await tokenRequest(provider, {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
  });
  const tokens = toTokens(data);
  const finish = PROVIDERS[provider].finish;
  if (finish) return finish(tokens, data);
  return { tokens, account: await accountLabel(provider, tokens.accessToken, data) };
}

async function accountLabel(
  provider: OAuthProvider,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<string> {
  try {
    if (provider === "slack") {
      return `${(data.team as { name?: string } | undefined)?.name ?? "Slack"} workspace`;
    }
    const url =
      provider === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : provider === "microsoft"
          ? "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"
          : "https://api.github.com/user";
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "user-agent": "Desker" },
    });
    const me = (await response.json()) as { email?: string; login?: string; mail?: string; userPrincipalName?: string };
    return me.email ?? me.mail ?? me.userPrincipalName ?? (me.login ? `@${me.login}` : provider);
  } catch {
    return provider;
  }
}

/** Creates the connection, or replaces the tokens on an existing one of the same kind. */
export async function saveConnection(input: {
  organizationId: string;
  connectorId: string;
  tokens: ConnectorTokens;
  account: string;
}) {
  const connector = connectorById(input.connectorId);
  if (!connector) throw new Error("Unknown connector.");
  const data = {
    name: connector.name,
    config: { account: input.account } as Prisma.InputJsonValue,
    secret: seal(input.tokens),
    enabled: true,
  };
  const existing = await prisma.integration.findFirst({
    where: { organizationId: input.organizationId, type: input.connectorId },
    select: { id: true },
  });
  return existing
    ? prisma.integration.update({ where: { id: existing.id }, data })
    : prisma.integration.create({ data: { ...data, organizationId: input.organizationId, type: input.connectorId } });
}

/**
 * A usable access token for a connected connector, refreshed if it is about
 * to expire. Null when the organisation has not connected it - the caller
 * degrades gracefully rather than failing the run.
 */
export async function connectorAccess(
  organizationId: string,
  connectorId: string,
): Promise<{ accessToken: string; account: string; extra: Record<string, unknown> } | null> {
  const row = await prisma.integration.findFirst({
    where: { organizationId, type: connectorId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row?.secret) return null;
  const connector = connectorById(connectorId);
  const provider = connector?.oauthProvider;
  let tokens = open<ConnectorTokens>(row.secret);
  const account = ((row.config as Record<string, string> | null) ?? {}).account ?? connectorId;

  const custom = provider ? PROVIDERS[provider].refresh : undefined;
  // Threads' 60-day token renews itself a week before it would lapse.
  const margin = custom ? 7 * 86_400_000 : 60_000;
  if (provider && tokens.expiresAt && tokens.expiresAt < Date.now() + margin) {
    if (custom && oauthConfigured(provider) && tokens.expiresAt > Date.now()) {
      tokens = await custom(tokens);
    } else {
      if (!tokens.refreshToken || !oauthConfigured(provider)) return null;
      const data = await tokenRequest(provider, {
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      });
      // Google keeps the old refresh token and omits it from the answer.
      tokens = { ...toTokens(data), refreshToken: String(data.refresh_token ?? tokens.refreshToken), extra: tokens.extra };
    }
    await prisma.integration.update({ where: { id: row.id }, data: { secret: seal(tokens) } });
  }
  return { accessToken: tokens.accessToken, account, extra: tokens.extra ?? {} };
}
