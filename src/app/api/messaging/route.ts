import type { Prisma } from "@prisma/client";
import { handle, parseJson, requireAdmin } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { validTimeZone } from "@/lib/shared/local-time";
import { prefsSchema } from "@/lib/messaging/prefs";
import { alertSettings } from "@/lib/messaging/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { userId } = await requireAdmin();
    return alertSettings(userId);
  });
}

/** The whole settings object: the page sends it back on every change. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const prefs = await parseJson(request, prefsSchema);
    const clean = { ...prefs, timeZone: validTimeZone(prefs.timeZone), brief: { ...prefs.brief, days: [...new Set(prefs.brief.days)] } };
    const memberships = await prisma.membership.findMany({ where: { userId }, select: { organizationId: true } });
    const projects = await prisma.project.findMany({ where: { organizationId: { in: memberships.map((membership) => membership.organizationId) } }, select: { id: true } });
    const agents = await prisma.agent.findMany({ where: { projectId: { in: projects.map((project) => project.id) } }, select: { id: true } });
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { alertPrefs: clean as Prisma.InputJsonValue } }),
      prisma.scopeOfWork.updateMany({ where: { agentId: { in: agents.map((agent) => agent.id) } }, data: { timezone: clean.timeZone } }),
      prisma.routine.updateMany({ where: { agentId: { in: agents.map((agent) => agent.id) } }, data: { timezone: clean.timeZone } }),
      prisma.project.updateMany({ where: { id: { in: projects.map((project) => project.id) } }, data: { checkInTimezone: clean.timeZone } }),
    ]);
    return alertSettings(userId);
  });
}
