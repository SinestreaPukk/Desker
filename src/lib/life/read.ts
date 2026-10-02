import "server-only";
import { prisma } from "@/lib/db";
import { buildLife, renderLife, type Life } from "./context";

const DAY = 86_400_000;

/** Reads the whole life context for a personal space. */
export async function readLife(projectId: string, now = new Date()): Promise<Life> {
  const where = { projectId };
  const [events, entries, tasks, goals, workouts, prefs, notes] = await Promise.all([
    prisma.lifeEvent.findMany({ where: { ...where, startsAt: { lte: new Date(now.getTime() + 30 * DAY) } }, take: 300 }),
    prisma.lifeEntry.findMany({ where: { ...where, occurredAt: { gte: new Date(now.getTime() - 120 * DAY) } }, take: 2000 }),
    prisma.lifeTask.findMany({ where: { ...where, status: "open" }, take: 200 }),
    prisma.lifeGoal.findMany({ where: { ...where, status: "active" }, take: 50 }),
    prisma.lifeWorkout.findMany({ where: { ...where, status: "planned" }, take: 100 }),
    prisma.lifePreference.findMany({ where }),
    prisma.lifeNote.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return buildLife({ events, entries, tasks, goals, workouts, prefs, notes }, now);
}

export async function lifeText(projectId: string, tz?: string): Promise<string> {
  return renderLife(await readLife(projectId), tz);
}
