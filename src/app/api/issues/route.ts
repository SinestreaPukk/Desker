import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject, projectsVisibleTo } from "@/lib/projects";
import type { IssueDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) {
      throw new HttpError(404, "That project no longer exists.");
    }

    const agentId = url.searchParams.get("agentId");
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const includePreviews = url.searchParams.get("includePreviews") === "true";

    const source = url.searchParams.get("source");

    // Tenancy through the agent, which every issue has; the conversation
    // filter only exists to hide preview chats, which agent-raised issues
    // never come from.
    const where: Prisma.IssueWhereInput = {
      ...(status && status !== "all" ? { status } : {}),
      ...(type && type !== "all" ? { type } : {}),
      ...(source && source !== "all" ? { source } : {}),
      agent: project ? { projectId: project.id } : { project: projectsVisibleTo(userId) },
      ...(agentId ? { agentId } : {}),
      ...(includePreviews
        ? {}
        : {
            OR: [
              { conversationId: null },
              { conversation: { NOT: { clientSessionId: { startsWith: "preview:" } } } },
            ],
          }),
    };

    const issues = await prisma.issue.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { agent: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return issues.map(
      (issue): IssueDto => ({
        id: issue.id,
        conversationId: issue.conversationId,
        actionItemId: issue.actionItemId,
        source: issue.source,
        type: issue.type,
        summary: issue.summary,
        severity: issue.severity,
        details: issue.details,
        status: issue.status,
        createdAt: issue.createdAt.toISOString(),
        agent: issue.agent,
      }),
    );
  });
}
