/**
 * Fixed-window rate limiter for the public chat endpoint.
 *
 * In-memory: correct for a single instance, which is what the MVP deploys as.
 * The one thing it must not do is fail open on the happy path, because what it
 * is protecting is an API bill.
 */
import "server-only";
import { env } from "@/lib/env";

interface Window {
  count: number;
  resetAt: number;
}

const globalForLimiter = globalThis as unknown as {
  rateWindows?: Map<string, Window>;
};

const windows = globalForLimiter.rateWindows ?? new Map<string, Window>();
if (process.env.NODE_ENV !== "production") globalForLimiter.rateWindows = windows;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number = env.chatRateLimit,
  windowMs: number = env.chatRateLimitWindowMs,
): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep; the map would otherwise grow with every session seen.
  if (windows.size > 5000) {
    for (const [existing, window] of windows) {
      if (window.resetAt <= now) windows.delete(existing);
    }
  }

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (window.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  window.count += 1;
  return {
    allowed: true,
    remaining: limit - window.count,
    retryAfterSeconds: 0,
  };
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}
