/**
 * Proactive alerts: a bill coming due, a clash the reasoning engine can see,
 * a deadline or a workout about to start. `dueAlerts` is pure and tested;
 * `runLifeAlerts` sends each one once, to every messaging app the person
 * linked (LINE included) AND into the web chat's shared thread, so whichever
 * app they answer in has the same context.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { messageUser } from "@/lib/messaging/send";
import { addTeamMessage, teamOf } from "@/lib/agents/team";
import { EVERYDAY_THREAD } from "./chat";
import { readLife } from "./read";
import { detectConflicts } from "./conflicts";
import type { Life } from "./context";

const HOUR = 3_600_000;
export interface Alert {
  key: string;
  title: string;
  body: string;
}

const money = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function dueAlerts(life: Life, now = new Date()): Alert[] {
  const out: Alert[] = [];
  for (const b of life.money.unpaidBills) {
    const left = b.occurredAt.getTime() - now.getTime();
    if (left < 0) out.push({ key: `bill-overdue:${b.id}`, title: "Bill overdue", body: `${b.payee} (${money(b.amountMinor, b.currency)}) was due ${day(b.occurredAt)}.` });
    else if (left <= 48 * HOUR) out.push({ key: `bill:${b.id}`, title: "Bill due soon", body: `${b.payee}, ${money(b.amountMinor, b.currency)}, is due ${day(b.occurredAt)}.` });
  }
  for (const w of life.workouts) {
    const left = w.scheduledAt.getTime() - now.getTime();
    if (left > 0 && left <= 2 * HOUR) out.push({ key: `workout:${w.id}`, title: "Workout soon", body: `${w.title} at ${time(w.scheduledAt)}.` });
  }
  for (const t of life.openTasks) {
    const left = t.dueAt ? t.dueAt.getTime() - now.getTime() : Infinity;
    // A reminder is for its moment, not the day before: the sweep only catches one that was missed.
    if (t.kind === "reminder") {
      if (left <= 0) out.push({ key: `reminder:${t.id}`, title: "Reminder", body: t.title });
      continue;
    }
    if (left > 0 && left <= 24 * HOUR) out.push({ key: `task:${t.id}`, title: "Due within a day", body: `${t.title} is due ${day(t.dueAt!)}.` });
  }
  // A clash is worth a nudge once: key it by what clashes, not by when we noticed.
  for (const c of detectConflicts(life).filter((c) => c.severity === "high" || c.kind === "workout_clash")) out.push({ key: `conflict:${c.summary}`, title: "Schedule clash", body: c.summary });
  return out;
}

export async function runLifeAlerts(now = new Date()): Promise<number> {
  const projects = await prisma.project.findMany({ where: { agents: { some: { status: "published" } } }, select: { id: true, organizationId: true, organization: { select: { memberships: { select: { userId: true } } } } } });
  let sent = 0;
  for (const project of projects) {
    try {
      const alerts = dueAlerts(await readLife(project.id, now), now);
      for (const alert of alerts) {
        // Claimed first: the unique key means two overlapping ticks cannot both send it.
        const claimed = await prisma.lifeAlertSent.create({ data: { projectId: project.id, key: alert.key.slice(0, 300) } }).then(() => true, () => false);
        if (!claimed) continue;
        const message = { title: alert.title, body: alert.body };
        await Promise.all(project.organization.memberships.map((m) => messageUser(m.userId, message, { event: "life", organizationId: project.organizationId })));
        const team = await teamOf(project.id);
        const speaker = team.find((a) => a.templateId === "personal-assistant") ?? team[0];
        if (speaker) {
          const thread = (await prisma.teamThread.findFirst({ where: { projectId: project.id, title: EVERYDAY_THREAD }, select: { id: true } })) ?? (await prisma.teamThread.create({ data: { projectId: project.id, title: EVERYDAY_THREAD }, select: { id: true } }));
          await addTeamMessage({ projectId: project.id, threadId: thread.id, agentId: speaker.id, content: `${alert.title}: ${alert.body}` });
        }
        if (alert.key.startsWith("reminder:")) await prisma.lifeTask.update({ where: { id: alert.key.slice(9) }, data: { status: "done" } }).catch(() => {});
        sent++;
      }
    } catch (error) {
      console.error(`[life] alerts failed for ${project.id}`, error);
    }
  }
  return sent;
}
