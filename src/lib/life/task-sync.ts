/** The to-do half of two-way sync: the person's real to-do list read into LifeTask (see calendar-sync.ts). */
import "server-only";
import { prisma } from "@/lib/db";
import { listTasks, tasksAccess } from "@/lib/integrations/tasks";

const STALE_MS = 5 * 60_000;
// ponytail: per-process memory; with several instances a sync may run twice, which is harmless.
const last = new Map<string, number>();

export async function syncTasks(organizationId: string, force = false): Promise<boolean> {
  if (!force && Date.now() - (last.get(organizationId) ?? 0) < STALE_MS) return true;
  const access = await tasksAccess(organizationId);
  if (!access) return false;
  const project = await prisma.project.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!project) return false;
  last.set(organizationId, Date.now());

  const source = access.provider === "google" ? "google_tasks" : "microsoft_todo";
  const remote = await listTasks(access);
  const seen: string[] = [];
  for (const t of remote) {
    seen.push(t.id);
    const due = t.due ? new Date(t.due) : null;
    const data = { title: t.title.slice(0, 300), dueAt: due && !Number.isNaN(due.getTime()) ? due : null, status: "open" };
    const row = await prisma.lifeTask.findFirst({ where: { projectId: project.id, externalId: t.id }, select: { id: true } });
    if (row) await prisma.lifeTask.update({ where: { id: row.id }, data });
    else await prisma.lifeTask.create({ data: { ...data, projectId: project.id, source, externalId: t.id } });
  }
  // Open here but gone from the real list: it was completed or deleted there.
  await prisma.lifeTask.updateMany({
    where: { projectId: project.id, source, status: "open", externalId: { notIn: seen } },
    data: { status: "done" },
  });
  return true;
}
