import "server-only";
import { env } from "@/lib/platform/env";

/** The nonce cookie that binds an OAuth round trip to the browser that started it. */
export const NONCE_COOKIE = "desker_oauth_nonce";
/** X's PKCE verifier, kept in this browser until the callback swaps the code. */
export const PKCE_COOKIE = "desker_oauth_pkce";

/** The callback address registered with each provider: one per provider, not per connector. */
export function callbackUrl(request: Request, provider: string): string {
  const origin = env.appUrl || new URL(request.url).origin;
  return `${origin}/api/integrations/oauth/callback/${provider}`;
}

/** Back to a page in the app, with a one-line outcome the page can show. */
export function backTo(request: Request, path: string, outcome: Record<string, string>): URL {
  const url = new URL(path, env.appUrl || new URL(request.url).origin);
  for (const [key, value] of Object.entries(outcome)) url.searchParams.set(key, value);
  return url;
}
