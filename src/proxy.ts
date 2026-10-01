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
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/login-guard";

const EXEMPT =
  /^\/api\/(inngest|cron|health|monitoring|auth|hooks|billing\/webhook|messaging\/(line|whatsapp|telegram)|integrations\/oauth)(\/|$)/;

export async function proxy(request: NextRequest) {
  if (EXEMPT.test(request.nextUrl.pathname)) return NextResponse.next();
  try {
    const result = await checkRateLimit(`api-ip:${clientIp(request)}`, env.apiRateLimit, 60_000);
    if (!result.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${result.retryAfterSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
  } catch {
    // ponytail: fail open if the limiter's database is down; the app is down too then, and a 429 storm helps nobody.
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
