/**
 * Fixed-window rate limits, counted in the database.
 *
 * Shared across every server instance: an in-memory counter lets each of N
 * instances allow the full limit, so the real limit becomes N times it the
 * moment the platform scales out. The one thing it must not do is fail open
 * on the happy path, because what it protects is a shared API bill and a
 * shared job queue.
 *
 * Two kinds of limit use it. Abuse limits key on a caller (an IP, a chat
 * session). Fairness limits key on an organisation - see limitOrganization -
 * and are separate from plan limits: a plan caps what an organisation pays
 * for, these cap how fast one organisation can draw on infrastructure every
 * other organisation shares.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number = env.chatRateLimit,
  windowMs: number = env.chatRateLimitWindowMs,
): Promise<RateLimitResult> {
  const now = new Date();
  const freshReset = new Date(now.getTime() + windowMs);

  // Count first; an expired window is reset by exactly one caller - the
  // conditional update below only matches while it is still expired.
  let row = await prisma.rateLimitWindow.upsert({
    where: { key },
    create: { key, count: 1, resetAt: freshReset },
    update: { count: { increment: 1 } },
  });
  if (row.resetAt <= now) {
    const reset = await prisma.rateLimitWindow.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 1, resetAt: freshReset },
    });
    row = reset.count > 0 ? { key, count: 1, resetAt: freshReset } : await prisma.rateLimitWindow.findUniqueOrThrow({ where: { key } });
  }

  // Keep the table to live windows. Cheap, and rare enough not to matter.
  if (Math.random() < 0.01) {
    void prisma.rateLimitWindow
      .deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 60 * 60_000) } } })
      .catch(() => {});
  }

  if (row.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
    };
  }
  return { allowed: true, remaining: limit - row.count, retryAfterSeconds: 0 };
}

/**
 * Per-organisation fairness buckets. `model` covers everything that calls a
 * model on demand (chat, previews, drafts from documents, digests on demand);
 * `runs` covers autonomous runs being started, however they are started.
 */
export const ORGANIZATION_LIMITS = {
  model: { limit: env.orgModelCallsPerMinute, windowMs: 60_000 },
  runs: { limit: env.orgRunsPerMinute, windowMs: 60_000 },
} as const;

export class OrganizationRateLimited extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

/** Throws OrganizationRateLimited when one organisation is going faster than its fair share. */
export async function limitOrganization(
  organizationId: string,
  bucket: keyof typeof ORGANIZATION_LIMITS,
): Promise<void> {
  const { limit, windowMs } = ORGANIZATION_LIMITS[bucket];
  const result = await checkRateLimit(`org-${bucket}:${organizationId}`, limit, windowMs);
  if (!result.allowed) {
    throw new OrganizationRateLimited(
      bucket === "runs"
        ? `Too many runs started in the last minute. Try again in ${result.retryAfterSeconds}s.`
        : `Your organisation is sending requests faster than the platform allows. Try again in ${result.retryAfterSeconds}s.`,
      result.retryAfterSeconds,
    );
  }
}
