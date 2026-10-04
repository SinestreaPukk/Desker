import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handle, parseJson, requireAdmin } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { readPrefs } from "@/lib/messaging/prefs";
import { validTimeZone } from "@/lib/shared/local-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Initialize an unset/legacy UTC preference from the owner's browser zone. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { timeZone: requested } = await parseJson(request, z.object({ timeZone: z.string().trim().min(1).max(64) }));
    const timeZone = validTimeZone(requested);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { alertPrefs: true } });
    const prefs = readPrefs(user.alertPrefs);
    if (user.alertPrefs != null && prefs.timeZone !== "UTC") return { saved: false };

    const clean = { ...prefs, timeZone };
    const memberships = await prisma.membership.findMany({ where: { userId }, select: { organizationId: true } });
    const projects = await prisma.project.findMany({ where: { organizationId: { in: memberships.map((membership) => membership.organizationId) } }, select: { id: true } });
    const agents = await prisma.agent.findMany({ where: { projectId: { in: projects.map((project) => project.id) } }, select: { id: true } });
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { alertPrefs: clean as Prisma.InputJsonValue } }),
      prisma.scopeOfWork.updateMany({ where: { agentId: { in: agents.map((agent) => agent.id) } }, data: { timezone: timeZone } }),
      prisma.routine.updateMany({ where: { agentId: { in: agents.map((agent) => agent.id) } }, data: { timezone: timeZone } }),
      prisma.project.updateMany({ where: { id: { in: projects.map((project) => project.id) } }, data: { checkInTimezone: timeZone } }),
    ]);
    return { saved: true };
  });
}
