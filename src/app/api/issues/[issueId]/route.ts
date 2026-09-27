import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { publishAdminEvent } from "@/lib/events";
import { audit } from "@/lib/audit";
import { agentsVisibleTo } from "@/lib/projects";
import { issuePatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ issueId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { issueId } = await params;
    const input = await parseJson(request, issuePatchSchema);
    const visible = await prisma.issue.findFirst({ where: { id: issueId, agent: agentsVisibleTo(userId) }, select: { id: true } });
    if (!visible) throw new HttpError(404, "That item no longer exists.");

    const issue = await prisma.issue
      .update({
        where: { id: issueId },
        data: { status: input.status },
        select: { id: true, status: true, conversationId: true },
      })
      .catch(() => {
        throw new HttpError(404, "That item no longer exists.");
      });

    publishAdminEvent({ type: "issue.updated", issueId: issue.id });

    return issue;
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { issueId } = await params;
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, agent: agentsVisibleTo(userId) },
      select: { id: true, agent: { select: { project: { select: { organizationId: true } } } } },
    });
    if (!issue) throw new HttpError(404, "That item no longer exists.");
    await prisma.issue.delete({ where: { id: issueId } });
    await audit({
      organizationId: issue.agent.project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "issue.deleted",
      targetType: "issue",
      targetId: issueId,
    });
    publishAdminEvent({ type: "issue.updated", issueId });
    return { ok: true };
  });
}
