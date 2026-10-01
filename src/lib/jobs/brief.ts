/** Morning briefs: a quarter-hourly tick, like digests. Fifteen minutes late on "07:30" goes unnoticed. */
import { inngest } from "./client";
import { runDueBriefs } from "@/lib/messaging/brief";

export const briefScheduler = inngest.createFunction(
  { id: "brief-scheduler", name: "Send due morning briefs", triggers: { cron: "*/15 * * * *" } },
  async ({ step }) => ({ sent: await step.run("run-due-briefs", () => runDueBriefs()) }),
);
