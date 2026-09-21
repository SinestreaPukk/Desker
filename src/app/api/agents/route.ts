import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentInputSchema } from "@/lib/validation";
import { findProject, projectsVisibleTo } from "@/lib/projects";
import { canPublishAgent } from "@/lib/billing/limits";
import { toAgentDetail, type AgentSummaryDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();

    // Every admin surface is scoped to one project; an unscoped list would
    // silently mix two clients' rosters together. Without a project it is
    // still bounded to the organisations the caller belongs to.
    const handle_ = new URL(request.url).searchParams.get("project");
    const project = handle_ ? await findProject(handle_, userId) : null;
    if (handle_ && !project) throw new HttpError(404, "That project no longer exists.");

    const agents = await prisma.agent.findMany({
      where: project ? { projectId: project.id } : { project: projectsVisibleTo(userId) },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        department: true,
        avatarUrl: true,
        status: true,
        modelProvider: true,
        updatedAt: true,
        _count: { select: { conversations: true, documents: true } },
      },
    });

    // One grouped query instead of N per-agent counts.
    const openIssues = await prisma.issue.groupBy({
      by: ["agentId"],
      where: { status: "open" },
      _count: { _all: true },
    });
    const openIssuesByAgent = new Map<string, number>();
    for (const row of openIssues) {
      const agentId = row.agentId;
      openIssuesByAgent.set(
        agentId,
        (openIssuesByAgent.get(agentId) ?? 0) + row._count._all,
      );
    }

    return agents.map(
      (agent): AgentSummaryDto => ({
        id: agent.id,
        name: agent.name,
        jobTitle: agent.jobTitle,
        department: agent.department,
        avatarUrl: agent.avatarUrl,
        status: agent.status,
        modelProvider: agent.modelProvider,
        conversationCount: agent._count.conversations,
        documentCount: agent._count.documents,
        openIssueCount: openIssuesByAgent.get(agent.id) ?? 0,
        updatedAt: agent.updatedAt.toISOString(),
      }),
    );
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, agentInputSchema);

    const projectHandle = new URL(request.url).searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (!project) {
      throw new HttpError(400, "An agent has to belong to a project.");
    }

    // Born published counts the same as published later.
    if (input.status === "published") {
      const check = await canPublishAgent(project.organizationId, "");
      if (!check.allowed) throw new HttpError(402, check.reason!);
    }

    const agent = await prisma.agent.create({
      data: {
        projectId: project.id,
        name: input.name,
        jobTitle: input.jobTitle,
        department: input.department || null,
        avatarUrl: input.avatarUrl || null,
        personality: input.personality,
        responsibilities: input.responsibilities,
        allowedTools: input.allowedTools,
        escalationRule: input.escalationRule || null,
        welcomeMessage: input.welcomeMessage || null,
        status: input.status,
        modelProvider: input.modelProvider,
        model: input.model || null,
        publicPasscode: input.publicPasscode || null,
        widgetLabel: input.widgetLabel || null,
        widgetColor: input.widgetColor || null,
        widgetSide: input.widgetSide ?? null,
      },
    });

    return toAgentDetail(agent);
  });
}
