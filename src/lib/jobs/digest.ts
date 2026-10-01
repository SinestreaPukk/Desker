/**
 * The Inngest side of digests.
 *
 * A quarter-hourly tick rather than a minute one: a digest is due at a
 * morning hour in the agent's own timezone, and fifteen minutes of slack on
 * "8am Monday" is invisible to a reader while costing a fraction of the run
 * history. Catch-up is the scheduler's job, not this function's - see
 * runDueDigests.
 */
import { inngest } from "./client";
import { runDueCheckIns, generateCheckInForAgent } from "@/lib/work/check-in";
import { captureError } from "@/lib/monitoring";

const DIGEST_CRON = "*/15 * * * *";

export const digestScheduler = inngest.createFunction(
  {
    id: "digest-scheduler",
    name: "Send due project check-ins",
    triggers: { cron: DIGEST_CRON },
  },
  async ({ step }) => {
    const generated = await step.run("run-due-check-ins", () => runDueCheckIns());
    return { generated };
  },
);

/**
 * One agent's digest, out of band: what the "Send me one now" button in the
 * editor fires. Off the request path because it makes a model call and may
 * send an email.
 */
export const digestNowFn = inngest.createFunction(
  {
    id: "digest-generate",
    name: "Generate one project check-in",
    triggers: { event: "work/digest.generate" },
    retries: 1,
    concurrency: [{ limit: 1, key: "event.data.agentId" }],
    onFailure: async ({ event, error }) => {
      captureError(error, {
        organizationId: String(event.data.event.data.organizationId ?? ""),
        route: "inngest:digest-generate",
      });
    },
  },
  async ({ event, step }) => {
    const agentId = String(event.data.agentId);
    const checkIn = await step.run("generate", () => generateCheckInForAgent(agentId));
    return { agentId, checkInId: checkIn?.id ?? null };
  },
);
