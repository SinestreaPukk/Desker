/**
 * Two-way calendar sync, the read half. Writes go out through the approved
 * calendar tools (create, move, cancel); this reads the real calendar back
 * into the life context so everything the reasoning engine weighs is what is
 * actually on the person's calendar, including entries made elsewhere. Run
 * after every approved change and, at most every few minutes, before reads.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { calendarAccess, listEvents } from "@/lib/integrations/mail-calendar";

const DAY = 86_400_000;
const STALE_MS = 5 * 60_000;
// ponytail: per-process memory; with several instances a sync may run twice, which is harmless.
const last = new Map<string, number>();

/** Pulls the next 30 days of the connected calendar into LifeEvent. Returns false when no calendar is connected. */
export async function syncCalendar(organizationId: string, force = false): Promise<boolean> {
  if (!force && Date.now() - (last.get(organizationId) ?? 0) < STALE_MS) return true;
  const access = await calendarAccess(organizationId);
  if (!access) return false;
  const project = await prisma.project.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!project) return false;
  last.set(organizationId, Date.now());

  const from = new Date();
  const to = new Date(from.getTime() + 30 * DAY);
  const remote = await listEvents(access, { from: from.toISOString(), to: to.toISOString() });
  const source = access.provider;
  const seen = new Set<string>();
  for (const e of remote) {
    const startsAt = new Date(e.start);
    if (Number.isNaN(startsAt.getTime())) continue;
    seen.add(e.id);
    const data = { title: e.title.slice(0, 300), startsAt, endsAt: new Date(e.end), allDay: e.allDay, status: "confirmed" };
    const row = await prisma.lifeEvent.findFirst({ where: { projectId: project.id, externalId: e.id }, select: { id: true } });
    if (row) await prisma.lifeEvent.update({ where: { id: row.id }, data });
    else await prisma.lifeEvent.create({ data: { ...data, projectId: project.id, source, externalId: e.id } });
  }
  // Gone from the real calendar inside the window: cancelled or moved out of it.
  await prisma.lifeEvent.updateMany({
    where: { projectId: project.id, source, status: { not: "cancelled" }, startsAt: { gte: from, lte: to }, externalId: { notIn: [...seen] } },
    data: { status: "cancelled" },
  });
  return true;
}
