/**
 * The watchdog for autonomous work. A scheduled agent that fails quietly is
 * worse than a manual one that fails in front of the person who pressed Run,
 * because nobody is watching - so the system watches.
 *
 * Every few minutes it looks for:
 * - runs past their time budget (the owner hears once; the platform hears how many),
 * - runs stuck far past it, which are failed so they stop holding a slot,
 * - work waiting in the queue longer than it should (the runtime is down or saturated),
 * - approvals left waiting on the owner for a day (a nudge, once a day, so drafts do not go stale),
 * - a platform-wide spike in failures or escalations, which usually means
 *   something upstream broke rather than many agents finding real problems.
 *
 * Platform alerts go to error monitoring and, when OPS_ALERT_WEBHOOK_URL is
 * set, to a chat channel (Slack-compatible). Each kind fires at most once an
 * hour so an outage is one page, not two hundred.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { captureMessage } from "@/lib/monitoring";
import { notifyInBackground } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { transition } from "./runner";

/** How long work may wait in the queue before it counts as a backlog. */
const QUEUE_WAIT_BUDGET_MS = 10 * 60_000;
/** A run this many budgets past its start is treated as dead, not slow. */
const STUCK_MULTIPLIER = 4;
/** How long an approval may wait before the owner is nudged, and how often after that. */
export const APPROVAL_NUDGE_MS = 24 * 60 * 60_000;

/**
 * Whether `current` is a spike against a baseline rate: well above normal and
 * above a floor, so a quiet platform going from 0 to 2 is not an incident.
 */
export function isSpike(current: number, baselinePerWindow: number, floor: number, factor = 3): boolean {
  return current >= floor && current > baselinePerWindow * factor;
}

interface OpsAlert {
  /** Stable id for deduplication, e.g. "escalation-spike". */
  key: string;
  title: string;
  detail: string;
}

/** Sends a platform alert unless the same kind already went out this hour. */
async function opsAlert(alert: OpsAlert): Promise<boolean> {
  const fresh = await checkRateLimit(`ops-alert:${alert.key}`, 1, 60 * 60_000);
  if (!fresh.allowed) return false;
  captureMessage(`[ops] ${alert.title}: ${alert.detail}`, { route: "watchdog", alert: alert.key });
  const url = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (url) {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `:rotating_light: *${alert.title}*\n${alert.detail}` }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => console.error("[watchdog] alert webhook failed", error));
  }
  return true;
}

interface WatchdogReport {
  overBudget: number;
  approvalsNudged: number;
  stuckFailed: number;
  queued: number;
  oldestQueuedMs: number | null;
  failedRecent: number;
  escalationsRecent: number;
  alerts: string[];
}

export async function checkAutonomousWork(now = new Date()): Promise<WatchdogReport> {
  const budget = env.runTimeBudgetMs;
  const alerts: string[] = [];
  const raise = async (alert: OpsAlert) => {
    if (await opsAlert(alert)) alerts.push(alert.key);
  };

  // --- runs past their time budget ------------------------------------------
  const slow = await prisma.actionItem.findMany({
    where: { status: "in_progress", startedAt: { lt: new Date(now.getTime() - budget) } },
    select: {
      id: true,
      startedAt: true,
      result: true,
      organizationId: true,
      agentId: true,
      agent: { select: { name: true, project: { select: { slug: true } } } },
    },
    take: 200,
  });

  let overBudget = 0;
  let stuckFailed = 0;
  for (const run of slow) {
    const age = now.getTime() - run.startedAt!.getTime();
    const path = `/p/${run.agent.project.slug}/work/${run.id}`;
    if (age > budget * STUCK_MULTIPLIER) {
      // Dead, not slow: free the slot and make it a visible failure.
      const minutes = Math.round(age / 60_000);
      const error = `Stopped: still running after ${minutes} minutes, far past the ${Math.round(budget / 60_000)}-minute budget. It was most likely interrupted; run it again.`;
      await transition(run.id, "failed", { error }).catch(() => {});
      await prisma.issue
        .create({
          data: {
            agentId: run.agentId,
            actionItemId: run.id,
            source: "agent",
            type: "failure",
            severity: "medium",
            summary: "A task stopped responding and was ended",
            details: error,
          },
        })
        .catch(() => {});
      notifyInBackground({ kind: "run_failed", title: "A task stopped responding", body: error, agentName: run.agent.name, path, severity: "medium", organizationId: run.organizationId });
      stuckFailed++;
      continue;
    }

    overBudget++;
    const result = (run.result as Record<string, unknown> | null) ?? {};
    if (result.overBudgetNotifiedAt) continue;
    await prisma.actionItem.update({
      where: { id: run.id },
      data: { result: { ...result, overBudgetNotifiedAt: now.toISOString() } as Prisma.InputJsonValue },
    });
    notifyInBackground({
      kind: "run_failed",
      title: "A task is taking much longer than usual",
      body: `Running for ${Math.round(age / 60_000)} minutes. It may still finish; if it does not, it will be stopped and reported.`,
      agentName: run.agent.name,
      path,
      severity: "low",
      organizationId: run.organizationId,
    });
  }
  if (overBudget + stuckFailed >= 5) {
    await raise({
      key: "runs-over-budget",
      title: `${overBudget + stuckFailed} runs past their time budget`,
      detail: `${overBudget} still running, ${stuckFailed} ended as stuck. Many at once usually means the model provider or a tool is slow or down.`,
    });
  }

  // --- approvals left waiting on the owner -------------------------------------
  // A draft waiting on a decision goes stale; the owner hears once a day, so it
  // is a nudge, not a nag.
  const stale = await prisma.actionItem.findMany({
    where: { status: "needs_approval", awaitingSince: { lt: new Date(now.getTime() - APPROVAL_NUDGE_MS) } },
    select: {
      id: true,
      headline: true,
      awaitingSince: true,
      result: true,
      organizationId: true,
      agent: { select: { name: true, project: { select: { slug: true } } } },
    },
    take: 200,
  });
  let approvalsNudged = 0;
  for (const item of stale) {
    const result = (item.result as Record<string, unknown> | null) ?? {};
    const last = typeof result.approvalNudgedAt === "string" ? Date.parse(result.approvalNudgedAt) : 0;
    if (now.getTime() - last < APPROVAL_NUDGE_MS) continue;
    await prisma.actionItem.update({
      where: { id: item.id },
      data: { result: { ...result, approvalNudgedAt: now.toISOString() } as Prisma.InputJsonValue },
    });
    const days = Math.floor((now.getTime() - item.awaitingSince!.getTime()) / APPROVAL_NUDGE_MS);
    notifyInBackground({
      kind: "approval_waiting",
      title: `Waiting on your OK for ${days === 1 ? "a day" : `${days} days`}`,
      body: `${item.headline ?? "A draft"}. Approve it or reject it so it does not go out of date.`,
      agentName: item.agent.name,
      path: `/p/${item.agent.project.slug}/work/${item.id}`,
      severity: "low",
      organizationId: item.organizationId,
    });
    approvalsNudged++;
  }

  // --- work waiting too long in the queue --------------------------------------
  const waitingSince = new Date(now.getTime() - QUEUE_WAIT_BUDGET_MS);
  const [queued, oldest] = await Promise.all([
    prisma.actionItem.count({ where: { status: "queued", OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] } }),
    prisma.actionItem.findFirst({
      where: { status: "queued", OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, scheduledFor: true },
    }),
  ]);
  const readyAt = oldest ? (oldest.scheduledFor && oldest.scheduledFor > oldest.createdAt ? oldest.scheduledFor : oldest.createdAt) : null;
  const oldestQueuedMs = readyAt ? now.getTime() - readyAt.getTime() : null;
  if (readyAt && readyAt < waitingSince) {
    await raise({
      key: "queue-backlog",
      title: "Autonomous work is backing up",
      detail: `${queued} runs waiting; the oldest for ${Math.round(oldestQueuedMs! / 60_000)} minutes. The job runtime is down or saturated - check Inngest and WORK_MAX_CONCURRENT_RUNS.`,
    });
  }

  // --- platform-wide spikes ------------------------------------------------------
  const day = 24 * 60 * 60_000;
  const quarter = 15 * 60_000;
  const [failedRecent, failedDay, escalationsRecent, escalationsWeek] = await Promise.all([
    prisma.actionItem.count({ where: { status: "failed", completedAt: { gte: new Date(now.getTime() - quarter) } } }),
    prisma.actionItem.count({
      where: { status: "failed", completedAt: { gte: new Date(now.getTime() - day), lt: new Date(now.getTime() - quarter) } },
    }),
    prisma.issue.count({ where: { type: "escalation", createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } } }),
    prisma.issue.count({
      where: { type: "escalation", createdAt: { gte: new Date(now.getTime() - 7 * day), lt: new Date(now.getTime() - 60 * 60_000) } },
    }),
  ]);
  const failedBaseline = failedDay / ((day - quarter) / quarter);
  if (isSpike(failedRecent, failedBaseline, 10)) {
    await raise({
      key: "failure-spike",
      title: "Spike in failed runs",
      detail: `${failedRecent} runs failed in the last 15 minutes against a usual ${failedBaseline.toFixed(1)}. Something shared - the model provider, the database, a deploy - is the likelier cause.`,
    });
  }
  const escalationBaseline = escalationsWeek / (7 * 24 - 1);
  if (isSpike(escalationsRecent, escalationBaseline, 10)) {
    await raise({
      key: "escalation-spike",
      title: "Spike in escalations across the platform",
      detail: `${escalationsRecent} escalations in the last hour against a usual ${escalationBaseline.toFixed(1)}. Many agents escalating at once usually means something upstream broke, not that they all found real problems.`,
    });
  }

  return { overBudget, approvalsNudged, stuckFailed, queued, oldestQueuedMs, failedRecent, escalationsRecent, alerts };
}

/** The queue as the health endpoint reports it. */
export async function workQueueStatus(now = new Date()) {
  const [queued, inProgress, oldest] = await Promise.all([
    prisma.actionItem.count({ where: { status: "queued", OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] } }),
    prisma.actionItem.count({ where: { status: "in_progress" } }),
    prisma.actionItem.findFirst({
      where: { status: "queued", OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const oldestQueuedMs = oldest ? now.getTime() - oldest.createdAt.getTime() : null;
  return {
    queued,
    inProgress,
    oldestQueuedMs,
    backlogged: oldestQueuedMs !== null && oldestQueuedMs > QUEUE_WAIT_BUDGET_MS,
  };
}
