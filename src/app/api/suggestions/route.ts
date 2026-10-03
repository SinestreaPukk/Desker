import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject, agentsVisibleTo } from "@/lib/tenancy/projects";
import { pendingSuggestionFilter } from "@/lib/work/suggestions";
import { isSuggestionStatus } from "@/lib/work/types";
import { suggestionInclude, toSuggestionDto } from "./serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the agents think should happen next. `status=open` means "waiting on a
 * decision", which includes a snooze that has run out.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) throw new HttpError(404, "That project no longer exists.");

    const agentId = url.searchParams.get("agentId");
    const status = url.searchParams.get("status");
    const now = new Date();

    const where: Prisma.SuggestionWhereInput = {
      agent: project ? { projectId: project.id } : agentsVisibleTo(userId),
      ...(agentId && agentId !== "all" ? { agentId } : {}),
      ...(status === "open"
        ? pendingSuggestionFilter(now)
        : status && status !== "all" && isSuggestionStatus(status)
          ? { status }
          : {}),
    };

    const suggestions = await prisma.suggestion.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: suggestionInclude,
    });
    return suggestions.map((row) => toSuggestionDto(row, now));
  });
}
