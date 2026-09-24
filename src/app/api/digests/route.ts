import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject, agentsVisibleTo } from "@/lib/projects";
import { digestInclude, toDigestDto } from "./serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Inbox's Updates tab: what the project's agents have reported, newest first. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) throw new HttpError(404, "That project no longer exists.");

    const agentId = url.searchParams.get("agentId");
    const status = url.searchParams.get("status");
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

    const where: Prisma.DigestWhereInput = {
      agent: project ? { projectId: project.id } : agentsVisibleTo(userId),
      ...(agentId && agentId !== "all" ? { agentId } : {}),
      ...(status === "unread" ? { readAt: null } : status === "read" ? { readAt: { not: null } } : {}),
    };

    const digests = await prisma.digest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: digestInclude,
    });
    return digests.map(toDigestDto);
  });
}
