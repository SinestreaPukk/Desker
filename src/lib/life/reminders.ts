/**
 * "Remind me to work in 30 seconds." A reminder is a LifeTask with a due
 * time, delivered once, exactly when due, to every app the person linked and
 * into the shared chat thread. Delivery has three paths so a missed one is
 * caught by the next: a short in-process wait for reminders under two minutes,
 * an Inngest function that sleeps until the due time for later ones, and the
 * 15-minute alert sweep as the safety net. All three claim the same key, so
 * only one ever sends.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";
import { getProvider } from "@/lib/llm/provider";
import { inngest } from "@/lib/jobs/client";
import { messageUser } from "@/lib/messaging/send";
import { clamp, parseModelJson, stringField } from "@/lib/work/model-json";
import { addTeamMessage, teamOf } from "@/lib/agents/team";
import * as store from "./store";

export const REMIND = /\bremind me\b|เตือน/i;
/** In-process waits stay under this: the invocation has minutes, not hours. */
export const SHORT_WAIT_MS = 150_000;

export interface Reminder {
  what: string;
  at: Date;
}

export function parseReminderJson(raw: Record<string, unknown> | null, now: Date): Reminder | null {
  const what = stringField(raw, "what").trim();
  const at = new Date(stringField(raw, "at"));
  if (!what || Number.isNaN(at.getTime())) return null;
  // A past time is the model resolving "9am" to this morning: not a reminder anyone can use.
  if (at.getTime() < now.getTime() - 5_000) return null;
  return { what: what.slice(0, 200), at };
}

/** The reminder in the message, with the time resolved to an exact instant in the person's time zone. Null when no usable time is given. */
export async function extractReminder(input: { text: string; now: Date; timeZone: string; organizationId: string; agent: { modelProvider: string; model: string | null } }): Promise<Reminder | null> {
  const { text, now, timeZone, organizationId, agent } = input;
  if (!(env.hasAnthropicKey || env.hasOpenAiKey)) return null;
  const provider = await getProvider(agent.modelProvider);
  const local = new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "full", timeStyle: "medium" }).format(now);
  const turn = await provider.complete({
    billing: { organizationId },
    systemPrompt: `The person asked to be reminded of something. Right now it is ${now.toISOString()} UTC; their local time is ${local} (${timeZone}). Reply with JSON only: {"what": "short reminder text, e.g. 'Work'", "at": "exact ISO 8601 time in UTC"}. Resolve relative times ("in 30 seconds", "tomorrow at 9") from now in their time zone. If they gave no time, reply {"what": "", "at": ""}.`,
    messages: [{ role: "user", content: text }],
    tools: [],
    model: agent.model,
    maxTokens: 120,
  });
  return parseReminderJson(parseModelJson(turn.message.content), now);
}

/** Saves the reminder and arranges its delivery. Returns what to run after the reply is sent (a short wait), if any. */
export async function createReminder(space: { organizationId: string; projectId: string }, reminder: Reminder, now = new Date()): Promise<{ id: string; later?: () => Promise<void> }> {
  const task = await store.addTask({ ...space, source: "chat" }, { title: reminder.what, kind: "reminder", dueAt: reminder.at });
  const wait = reminder.at.getTime() - now.getTime();
  if (wait <= SHORT_WAIT_MS) {
    return { id: task.id, later: async () => { await new Promise((r) => setTimeout(r, Math.max(0, wait))); await deliverReminder(task.id); } };
  }
  // Later ones: Inngest sleeps until the time. Not configured yet is fine: the 15-minute sweep still delivers it.
  await inngest.send({ name: "life/reminder.set", data: { taskId: task.id, at: reminder.at.toISOString() } }).catch((error: unknown) => console.warn("[life] reminder not scheduled with Inngest:", error instanceof Error ? error.message : error));
  return { id: task.id };
}

/** Sends one reminder, once, everywhere. Safe to call from any path. */
export async function deliverReminder(taskId: string): Promise<boolean> {
  const task = await prisma.lifeTask.findUnique({ where: { id: taskId }, select: { id: true, title: true, kind: true, status: true, projectId: true, project: { select: { organizationId: true, organization: { select: { memberships: { select: { userId: true } } } } } } } });
  if (!task || task.kind !== "reminder" || task.status !== "open") return false;
  const claimed = await prisma.lifeAlertSent.create({ data: { projectId: task.projectId, key: `reminder:${task.id}` } }).then(() => true, () => false);
  if (!claimed) return false;
  await prisma.lifeTask.update({ where: { id: task.id }, data: { status: "done" } });
  // Asked for by the person, so it ignores a paused-alerts setting.
  await Promise.all(task.project.organization.memberships.map((m) => messageUser(m.userId, { title: "Reminder", body: task.title }, { force: true })));
  const team = await teamOf(task.projectId);
  const speaker = team.find((a) => a.templateId === "personal-assistant") ?? team[0];
  if (speaker) {
    const thread = (await prisma.teamThread.findFirst({ where: { projectId: task.projectId, title: "Everyday chat" }, select: { id: true } })) ?? (await prisma.teamThread.create({ data: { projectId: task.projectId, title: "Everyday chat" }, select: { id: true } }));
    await addTeamMessage({ projectId: task.projectId, threadId: thread.id, agentId: speaker.id, content: clamp(`Reminder: ${task.title}`, 500) });
  }
  return true;
}
