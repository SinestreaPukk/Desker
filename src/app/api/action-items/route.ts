import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject, agentsVisibleTo } from "@/lib/tenancy/projects";
import { ACTION_STATUSES } from "@/lib/work/types";
import { toActionItemDto, actionItemInclude } from "./serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) throw new HttpError(404, "That project no longer exists.");

    const status = url.searchParams.get("status");
    const agentId = url.searchParams.get("agentId");
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1), 500);

    const where: Prisma.ActionItemWhereInput = {
      agent: project ? { projectId: project.id } : agentsVisibleTo(userId),
      ...(status && (ACTION_STATUSES as readonly string[]).includes(status) ? { status } : {}),
      ...(agentId ? { agentId } : {}),
    };

    const items = await prisma.actionItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: actionItemInclude,
    });
    // view=list: what a row shows. The steps, research, drafts and reports are
    // most of the weight, and the run's own page fetches them when opened.
    const lean = url.searchParams.get("view") === "list";
    return items.map((item) => {
      const dto = toActionItemDto(item);
      return lean ? { ...dto, steps: [], findings: [], drafts: [], report: null, summary: null } : dto;
    });
  });
}
