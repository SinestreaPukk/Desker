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
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { open, seal } from "@/lib/vault";
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
}

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
    scope: "chat:write,channels:read",
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

export function authorizeUrl(provider: OAuthProvider, redirectUri: string, stateToken: string, scope?: string): string {
  const spec = PROVIDERS[provider];
  const url = new URL(spec.authorizeUrl(process.env[spec.clientIdEnv]!.trim()));
  url.searchParams.set("client_id", process.env[spec.clientIdEnv]!.trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", stateToken);
  url.searchParams.set("response_type", "code");
  const scopes = scope ?? spec.scope;
  if (scopes) url.searchParams.set(spec.scopeParam, scopes);
  for (const [key, value] of Object.entries(spec.extraParams ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

interface ConnectorTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms; absent when the token does not expire. */
  expiresAt?: number;
}

async function tokenRequest(provider: OAuthProvider, params: Record<string, string>) {
  const spec = PROVIDERS[provider];
  const response = await fetch(spec.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env[spec.clientIdEnv]!.trim(),
      client_secret: process.env[spec.clientSecretEnv]!.trim(),
      ...params,
    }),
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
): Promise<{ tokens: ConnectorTokens; account: string }> {
  const data = await tokenRequest(provider, {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokens = toTokens(data);
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
): Promise<{ accessToken: string; account: string } | null> {
  const row = await prisma.integration.findFirst({
    where: { organizationId, type: connectorId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row?.secret) return null;
  const connector = connectorById(connectorId);
  const provider = connector?.oauthProvider;
  let tokens = open<ConnectorTokens>(row.secret);
  const account = ((row.config as Record<string, string> | null) ?? {}).account ?? connectorId;

  if (provider && tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000) {
    if (!tokens.refreshToken || !oauthConfigured(provider)) return null;
    const data = await tokenRequest(provider, {
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    // Google keeps the old refresh token and omits it from the answer.
    tokens = { ...toTokens(data), refreshToken: String(data.refresh_token ?? tokens.refreshToken) };
    await prisma.integration.update({ where: { id: row.id }, data: { secret: seal(tokens) } });
  }
  return { accessToken: tokens.accessToken, account };
}
