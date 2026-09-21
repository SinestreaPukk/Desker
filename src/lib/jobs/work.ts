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
import { fireDueScopes } from "@/lib/work/scope";
import { executeApprovedAction, runActionItem, type StepRunner } from "@/lib/work/runner";
import { prisma } from "@/lib/db";
import { captureError } from "@/lib/monitoring";
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
  async ({ step }) => {
    const started = await step.run("fire-due-scopes", () => fireDueScopes());
    return { started };
  },
);

export const runActionItemFn = inngest.createFunction(
  {
    id: "action-item-run",
    name: "Run an action item",
    triggers: { event: "work/action-item.run" },
    retries: 2,
    // One run per item at a time, and a few per organisation: a tenant with
    // fifty scheduled agents shares the runtime rather than owning it.
    concurrency: [
      { limit: 1, key: "event.data.actionItemId" },
      { limit: 3, key: "event.data.organizationId" },
    ],
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
