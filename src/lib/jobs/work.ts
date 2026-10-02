/**
 * The Inngest side of autonomous work: a minute-cadence scheduler that turns
 * due scopes into action items, a runner that executes one item as a chain
 * of durable steps, and the function that sends what a human approved.
 *
 * Every model turn and tool call inside a run is its own step, so a crash or
 * a platform timeout resumes from the last completed step rather than
 * re-running (and re-billing) the whole task.
 */
import { inngest } from "./client";
import { claimDueScopes, fireScope, type DueScope } from "@/lib/work/scope";
import { env } from "@/lib/env";
import { executeApprovedAction, runActionItem, type StepRunner } from "@/lib/work/runner";
import { prisma } from "@/lib/db";
import { captureError, withCronMonitor } from "@/lib/monitoring";
import { checkAutonomousWork } from "@/lib/work/watchdog";
import { transition } from "@/lib/work/runner";

type StepTools = { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> };

/** Adapts Inngest's step.run to the runner's StepRunner contract. */
function durable(step: StepTools): StepRunner {
  return ((id, fn) => step.run(id, fn)) as StepRunner;
}

export const scopeScheduler = inngest.createFunction(
  {
    id: "scope-scheduler",
    name: "Fire due scopes of work",
    triggers: { cron: "* * * * *" },
  },
  // Fan-out, so the scheduler's own work stays small however many schedules
  // come due at once: claim every due tick in one step, then hand each to its
  // own function run. 9am on a weekday is hundreds of these at the same time.
  async ({ step }) => {
    const due = (await step.run("claim-due-scopes", () => claimDueScopes())) as DueScope[];
    for (let i = 0; i < due.length; i += FAN_OUT_BATCH) {
      await step.sendEvent(
        `fan-out-${i / FAN_OUT_BATCH}`,
        due.slice(i, i + FAN_OUT_BATCH).map((tick) => ({ name: "work/scope.due" as const, data: tick })),
      );
    }
    return { due: due.length };
  },
);

const FAN_OUT_BATCH = 500;

/** One claimed tick becomes one run. Retry-safe: the tick's dedupe key stops a double. */
export const fireScopeFn = inngest.createFunction(
  {
    id: "scope-fire",
    name: "Start a scheduled run",
    triggers: { event: "work/scope.due" },
    retries: 3,
    // Starting a run is a handful of queries; this only protects the database
    // from a few hundred of them landing in the same second.
    concurrency: [{ limit: Math.min(25, env.workMaxConcurrentRuns) }],
  },
  async ({ event, step }) => {
    const id = await step.run("start-run", () => fireScope(event.data as DueScope));
    return { actionItemId: id };
  },
);

export const runActionItemFn = inngest.createFunction(
  {
    id: "action-item-run",
    name: "Run an action item",
    triggers: { event: "work/action-item.run" },
    retries: 2,
    // A duplicate event for the same item is dropped rather than run twice.
    idempotency: "event.data.actionItemId",
    // Two ceilings: the whole platform's (what the model provider's rate
    // limit and the database can carry), and each organisation's share of it,
    // so a tenant with fifty 9am agents queues behind itself, not in front of
    // everyone else.
    concurrency: [
      { limit: env.workMaxConcurrentRuns },
      { limit: 3, key: "event.data.organizationId" },
    ],
    // And a start rate per organisation: bursts are spread out, never dropped.
    throttle: { limit: env.orgRunsPerMinute, period: "1m", key: "event.data.organizationId" },
    // Out of retries: the item must not sit in in_progress forever with
    // nobody told. Fail it visibly and report it.
    onFailure: async ({ event, error }) => {
      const actionItemId = String(event.data.event.data.actionItemId);
      const organizationId = String(event.data.event.data.organizationId ?? "");
      captureError(error, { organizationId, actionItemId, route: "inngest:action-item-run" });
      await transition(actionItemId, "failed", {
        error: `The job runtime gave up after retries: ${error.message}`,
      }).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const actionItemId = String(event.data.actionItemId);

    // Follow-ups can be scheduled for later; wait here rather than polling.
    const scheduledFor = await step.run("scheduled-for", async () => {
      const item = await prisma.actionItem.findUnique({
        where: { id: actionItemId },
        select: { scheduledFor: true },
      });
      return item?.scheduledFor?.toISOString() ?? null;
    });
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      await step.sleepUntil("wait-until-scheduled", new Date(scheduledFor));
    }

    const status = await runActionItem(actionItemId, durable(step));
    return { actionItemId, status };
  },
);

export const executeApprovedFn = inngest.createFunction(
  {
    id: "action-item-execute-approved",
    name: "Send an approved action",
    triggers: { event: "work/action-item.execute" },
    retries: 1,
    concurrency: [{ limit: 1, key: "event.data.actionItemId" }],
  },
  async ({ event, step }) => {
    const actionItemId = String(event.data.actionItemId);
    const status = await executeApprovedAction(actionItemId, durable(step));
    return { actionItemId, status };
  },
);

const WATCHDOG_CRON = "*/5 * * * *";

/** Looks over every organisation's autonomous work for anything failing quietly. */
export const workWatchdogFn = inngest.createFunction(
  { id: "work-watchdog", name: "Watch autonomous work", triggers: { cron: WATCHDOG_CRON } },
  async ({ step }) => {
    const report = await step.run("check", () =>
      withCronMonitor("work-watchdog", WATCHDOG_CRON, () => checkAutonomousWork()),
    );
    return report;
  },
);
