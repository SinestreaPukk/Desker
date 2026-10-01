import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { projectsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { checkInInclude, toCheckInDto } from "../serialize";
import type { ProjectCheckInDto } from "@/lib/work/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ checkInId: string }> };
const readSchema = z.object({ read: z.boolean() });

async function owned(checkInId: string, userId: string) {
  const row = await prisma.projectCheckIn.findFirst({ where: { id: checkInId, project: projectsVisibleTo(userId) }, include: checkInInclude });
  if (!row) throw new HttpError(404, "That check-in no longer exists.");
  return row;
}
async function responseDto(id: string): Promise<ProjectCheckInDto> {
  const row = await prisma.projectCheckIn.findUniqueOrThrow({ where: { id }, include: checkInInclude });
  const ids = Array.isArray(row.suggestionIds) ? (row.suggestionIds as unknown[]).filter((value): value is string => typeof value === "string") : [];
  const suggestions = ids.length ? await prisma.suggestion.findMany({
    where: { id: { in: ids }, agent: { projectId: row.projectId } },
    select: { id: true, agentId: true, actionItemId: true, summary: true, rationale: true, proposal: true, status: true, snoozedUntil: true, agent: { select: { name: true } } },
  }) : [];
  const byId = new Map(suggestions.map((item) => [item.id, item]));
  return toCheckInDto(row, ids.flatMap((suggestionId) => {
    const item = byId.get(suggestionId);
    return item ? [{ id: item.id, agentId: item.agentId, agentName: item.agent.name, summary: item.summary, rationale: item.rationale, proposal: item.proposal, actionItemId: item.actionItemId, status: item.status as ProjectCheckInDto["suggestions"][number]["status"], pending: item.status === "open" || (item.status === "snoozed" && Boolean(item.snoozedUntil && item.snoozedUntil <= new Date())) }] : [];
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { checkInId } = await params;
    const input = await parseJson(request, readSchema);
    await owned(checkInId, userId);
    await prisma.projectCheckIn.update({ where: { id: checkInId }, data: { readAt: input.read ? new Date() : null } });
    return responseDto(checkInId);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { checkInId } = await params;
    const row = await owned(checkInId, userId);
    await prisma.projectCheckIn.delete({ where: { id: checkInId } });
    await audit({ organizationId: row.organizationId, actorType: "user", actorId: userId, action: "project.checkin.deleted", targetType: "project_checkin", targetId: checkInId });
    return { ok: true };
  });
}
