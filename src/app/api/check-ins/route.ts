import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { agentsVisibleTo, findProject, projectsVisibleTo } from "@/lib/tenancy/projects";
import { checkInInclude, toCheckInDto } from "./serialize";
import type { ProjectCheckInDto } from "@/lib/work/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);
    const handle_ = url.searchParams.get("project");
    const project = handle_ ? await findProject(handle_, userId) : null;
    if (handle_ && !project) throw new HttpError(404, "That project no longer exists.");
    const status = url.searchParams.get("status");
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
    const where: Prisma.ProjectCheckInWhereInput = {
      project: project ? { id: project.id } : { ...projectsVisibleTo(userId) },
      ...(status === "unread" ? { readAt: null } : status === "read" ? { readAt: { not: null } } : {}),
    };
    const rows = await prisma.projectCheckIn.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: checkInInclude });
    const allSuggestionIds = [...new Set(rows.flatMap((row) => Array.isArray(row.suggestionIds) ? (row.suggestionIds as unknown[]).filter((id): id is string => typeof id === "string") : []))];
    const suggestionRows = allSuggestionIds.length ? await prisma.suggestion.findMany({
      where: { id: { in: allSuggestionIds }, agent: project ? { projectId: project.id } : agentsVisibleTo(userId) },
      select: { id: true, agentId: true, actionItemId: true, summary: true, rationale: true, proposal: true, status: true, snoozedUntil: true, agent: { select: { name: true } } },
    }) : [];
    const suggestions = new Map(suggestionRows.map((item) => [item.id, item]));
    return rows.map((row) => {
      const ids = Array.isArray(row.suggestionIds) ? (row.suggestionIds as unknown[]).filter((id): id is string => typeof id === "string") : [];
      const items: ProjectCheckInDto["suggestions"] = ids.flatMap((id) => {
        const item = suggestions.get(id);
        return item ? [{ id: item.id, agentId: item.agentId, agentName: item.agent.name, summary: item.summary, rationale: item.rationale, proposal: item.proposal, actionItemId: item.actionItemId, status: item.status as ProjectCheckInDto["suggestions"][number]["status"], pending: item.status === "open" || (item.status === "snoozed" && Boolean(item.snoozedUntil && item.snoozedUntil <= new Date())) }] : [];
      });
      return toCheckInDto(row, items);
    });
  });
}
