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
import { runDueDigests, generateDigest } from "@/lib/work/digest";
import { captureError } from "@/lib/monitoring";

export const DIGEST_CRON = "*/15 * * * *";

export const digestScheduler = inngest.createFunction(
  {
    id: "digest-scheduler",
    name: "Send due agent digests",
    triggers: { cron: DIGEST_CRON },
  },
  async ({ step }) => {
    const generated = await step.run("run-due-digests", () => runDueDigests());
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
    name: "Generate one agent's digest",
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
    const digest = await step.run("generate", () => generateDigest(agentId, { force: true }));
    return { agentId, digestId: digest?.id ?? null };
  },
);
