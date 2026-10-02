/** Sleeps until a reminder is due, then delivers it: exact to the second, however far away. */
import { inngest } from "./client";
import { deliverReminder } from "@/lib/life/reminders";

export const lifeReminderFn = inngest.createFunction(
  { id: "life-reminder", name: "Deliver a reminder when due", triggers: { event: "life/reminder.set" } },
  async ({ event, step }) => {
    await step.sleepUntil("until-due", new Date(event.data.at as string));
    return { sent: await step.run("deliver", () => deliverReminder(event.data.taskId as string)) };
  },
);
