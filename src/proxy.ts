/**
 * A blanket per-address limit on every API route, so no endpoint is left
 * unguarded by someone forgetting to add one. Routes with their own tighter
 * limits (chat, sign-up, sign-in, contact) keep them; this is the floor.
 *
 * Skipped: callers that are platforms, not people, whose traffic arrives
 * from shared addresses (job runtime, billing, chat-network and inbound
 * webhooks, OAuth redirects, health checks) - those authenticate by
 * signature or secret instead. Sign-in has its own guard in login-guard.ts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/platform/env";
import { clientIp } from "@/lib/auth/login-guard";

const EXEMPT =
  /^\/api\/(inngest|cron|health|monitoring|auth|hooks|messaging\/(line|whatsapp|telegram)|integrations\/oauth)(\/|$)/;

/**
 * Per-address counts live in this instance's memory, not the database: this runs on every
 * API call, and a database write per call (the chat polls every few seconds) cost more than
 * the abuse it stops. ponytail: each serverless instance counts on its own, so the real
 * ceiling is limit x instances; a shared store (Redis) if that ever matters.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function proxy(request: NextRequest) {
  if (EXEMPT.test(request.nextUrl.pathname)) return NextResponse.next();
  const now = Date.now();
  const ip = clientIp(request);
  let window = windows.get(ip);
  if (!window || window.resetAt <= now) {
    if (windows.size > 5000) windows.clear();
    window = { count: 0, resetAt: now + 60_000 };
    windows.set(ip, window);
  }
  if (++window.count > env.apiRateLimit) {
    const retry = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    return NextResponse.json({ error: `Too many requests. Try again in ${retry}s.` }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
