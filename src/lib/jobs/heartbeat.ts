/**
 * Proof of life for the job runtime.
 *
 * Writes one Heartbeat row per tick and prunes the old ones. The health check
 * reports the age of the newest row, so a scheduler that has silently stopped
 * shows up as a failing /api/health rather than as an agent that never ran.
 */
import { prisma } from "@/lib/db";
import { inngest } from "./client";

export const HEARTBEAT_SOURCE = "heartbeat";

/**
 * Every minute in development, where the point is to watch it work; every
 * five in production, where a minute-cadence function is just noise in the
 * run history. `heartbeatIntervalMs` is what the health check measures against.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const HEARTBEAT_CRON = IS_PRODUCTION ? "*/5 * * * *" : "* * * * *";
export const heartbeatIntervalMs = (IS_PRODUCTION ? 5 : 1) * 60_000;

/** Keep a day of ticks: enough to eyeball gaps, not enough to grow forever. */
const RETENTION_MS = 24 * 60 * 60_000;

export const heartbeat = inngest.createFunction(
  {
    id: HEARTBEAT_SOURCE,
    name: "Job runtime heartbeat",
    triggers: { cron: HEARTBEAT_CRON },
  },
  async ({ step, runId }) => {
    // Step results are serialised, so hand back strings, not Dates.
    const row = await step.run("write-heartbeat", async () => {
      const created = await prisma.heartbeat.create({
        data: { source: HEARTBEAT_SOURCE, runId },
        select: { id: true, createdAt: true },
      });
      return { id: created.id, at: created.createdAt.toISOString() };
    });

    await step.run("prune-old-heartbeats", () =>
      prisma.heartbeat.deleteMany({
        where: {
          source: HEARTBEAT_SOURCE,
          createdAt: { lt: new Date(Date.now() - RETENTION_MS) },
        },
      }),
    );

    return { heartbeatId: row.id, at: row.at };
  },
);

/** The newest tick and whether it is recent enough to call the runtime alive. */
export async function heartbeatStatus() {
  const latest = await prisma.heartbeat.findFirst({
    where: { source: HEARTBEAT_SOURCE },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const ageMs = latest ? Date.now() - latest.createdAt.getTime() : null;
  return {
    lastHeartbeatAt: latest?.createdAt.toISOString() ?? null,
    ageMs,
    intervalMs: heartbeatIntervalMs,
    // Two missed ticks is a dead scheduler, not jitter.
    alive: ageMs !== null && ageMs < heartbeatIntervalMs * 2,
  };
}
