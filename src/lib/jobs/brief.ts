/** Morning briefs: a quarter-hourly tick, like digests. Fifteen minutes late on "07:30" goes unnoticed. */
import { inngest } from "./client";
import { runDueBriefs } from "@/lib/messaging/brief";
import { runDueLifeDigests } from "@/lib/life/digest";

export const briefScheduler = inngest.createFunction(
  { id: "brief-scheduler", name: "Send due morning briefs", triggers: { cron: "*/15 * * * *" } },
  async ({ step }) => ({ sent: await step.run("run-due-briefs", () => runDueBriefs()) }),
);

/** The weekly cross-domain digest: hourly tick, sent once on Monday morning. */
export const lifeDigestScheduler = inngest.createFunction(
  { id: "life-digest-scheduler", name: "Send weekly life digests", triggers: { cron: "0 * * * *" } },
  async ({ step }) => ({ sent: await step.run("run-due-life-digests", () => runDueLifeDigests()) }),
);
