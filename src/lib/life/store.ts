/**
 * The only way life context is written. Every change is audited, and each
 * write says who made it (`source`), so the context stays explainable.
 * Writes here change this product's own records; anything that leaves the
 * product (a real calendar, an email) still goes through the approval path.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export interface Actor {
  organizationId: string;
  projectId: string;
  /** user | agent:<id> | google | outlook | chat | engine */
  source: string;
}

function who(a: Actor) {
  return a.source.startsWith("agent:")
    ? { actorType: "agent" as const, actorId: a.source.slice(6) }
    : a.source === "engine"
      ? { actorType: "system" as const, actorId: null }
      : { actorType: "user" as const, actorId: null };
}

async function logged<T extends { id: string }>(a: Actor, action: string, target: string, row: Promise<T>) {
  const made = await row;
  await audit({ organizationId: a.organizationId, ...who(a), action, targetType: target, targetId: made.id });
  return made;
}

type EventIn = { title: string; startsAt: Date; endsAt?: Date; allDay?: boolean; location?: string; kind?: string; externalId?: string };
export const addEvent = (a: Actor, d: EventIn) =>
  logged(a, "life.event.added", "LifeEvent", prisma.lifeEvent.create({ data: { ...d, projectId: a.projectId, source: a.source } }));

export const updateEvent = (a: Actor, id: string, d: Partial<EventIn> & { status?: string }) =>
  logged(a, "life.event.updated", "LifeEvent", prisma.lifeEvent.update({ where: { id, projectId: a.projectId }, data: d }));

type EntryIn = {
  kind: "expense" | "income" | "bill";
  payee: string;
  amountMinor: number;
  currency?: string;
  category?: string;
  occurredAt: Date;
  status?: string;
  lineItems?: object;
  sourceRef?: string;
};
export const addEntry = (a: Actor, d: EntryIn & { sourceKind?: string }) => {
  const { sourceKind, lineItems, ...rest } = d;
  return logged(
    a,
    "life.entry.added",
    "LifeEntry",
    prisma.lifeEntry.create({
      data: { ...rest, lineItems, projectId: a.projectId, source: sourceKind ?? a.source },
    }),
  );
};

export const markBill = (a: Actor, id: string, status: "paid" | "unpaid" | "overdue") =>
  logged(a, "life.entry.updated", "LifeEntry", prisma.lifeEntry.update({ where: { id, projectId: a.projectId }, data: { status } }));

type TaskIn = { title: string; kind?: string; dueAt?: Date; externalId?: string };
export const addTask = (a: Actor, d: TaskIn) =>
  logged(a, "life.task.added", "LifeTask", prisma.lifeTask.create({ data: { ...d, projectId: a.projectId, source: a.source } }));

export const setTaskStatus = (a: Actor, id: string, status: "open" | "done" | "dropped") =>
  logged(a, "life.task.updated", "LifeTask", prisma.lifeTask.update({ where: { id, projectId: a.projectId }, data: { status } }));

type GoalIn = { title: string; domain?: string; target?: string; deadline?: Date };
export const addGoal = (a: Actor, d: GoalIn) =>
  logged(a, "life.goal.added", "LifeGoal", prisma.lifeGoal.create({ data: { ...d, projectId: a.projectId } }));

type WorkoutIn = { title: string; scheduledAt: Date; durationMin?: number; notes?: string };
export const addWorkout = (a: Actor, d: WorkoutIn) =>
  logged(a, "life.workout.added", "LifeWorkout", prisma.lifeWorkout.create({ data: { ...d, projectId: a.projectId, source: a.source } }));

export const setWorkoutStatus = (a: Actor, id: string, status: "planned" | "done" | "skipped") =>
  logged(a, "life.workout.updated", "LifeWorkout", prisma.lifeWorkout.update({ where: { id, projectId: a.projectId }, data: { status } }));

export const setPreference = (a: Actor, key: string, value: string) =>
  logged(
    a,
    "life.preference.set",
    "LifePreference",
    prisma.lifePreference.upsert({
      where: { projectId_key: { projectId: a.projectId, key } },
      create: { projectId: a.projectId, key, value },
      update: { value },
    }),
  );

export const addNote = (a: Actor, text: string) =>
  prisma.lifeNote.create({ data: { projectId: a.projectId, source: a.source, text: text.slice(0, 1000) } });
