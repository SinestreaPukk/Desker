import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { publishAdminEvent } from "@/lib/events";
import { audit } from "@/lib/audit";
import { agentsVisibleTo, canSeeConversation } from "@/lib/projects";
import { conversationPatchSchema } from "@/lib/validation";
import type { IssueDto, MessageDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { conversationId } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, agent: agentsVisibleTo(userId) },
      select: {
        id: true,
        status: true,
        replyMode: true,
        takenOverBy: true,
        summary: true,
        clientSessionId: true,
        createdAt: true,
        lastMessageAt: true,
        agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
        activeAgent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            authorName: true,
            createdAt: true,
          },
        },
        issues: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!conversation) throw new HttpError(404, "That conversation no longer exists.");

    return {
      id: conversation.id,
      status: conversation.status,
      mode: conversation.replyMode,
      takenOverBy: conversation.takenOverBy,
      summary: conversation.summary,
      isPreview: conversation.clientSessionId.startsWith("preview:"),
      agent: conversation.activeAgent ?? conversation.agent,
      // The agent the client originally contacted, if a router moved it since.
      originalAgent:
        conversation.activeAgent && conversation.activeAgent.id !== conversation.agent.id
          ? conversation.agent
          : null,
      createdAt: conversation.createdAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      messages: conversation.messages.map(
        (message): MessageDto => ({
          id: message.id,
          role: message.role,
          content: message.content,
          authorName: message.authorName,
          createdAt: message.createdAt.toISOString(),
        }),
      ),
      issues: conversation.issues.map(
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
        }),
      ),
    };
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { conversationId } = await params;
    const input = await parseJson(request, conversationPatchSchema);
    if (!(await canSeeConversation(conversationId, userId))) {
      throw new HttpError(404, "That conversation no longer exists.");
    }

    const conversation = await prisma.conversation
      .update({
        where: { id: conversationId },
        data: { status: input.status },
        select: { id: true, agentId: true, status: true },
      })
      .catch(() => {
        throw new HttpError(404, "That conversation no longer exists.");
      });

    publishAdminEvent({
      type: "conversation.updated",
      conversationId: conversation.id,
      agentId: conversation.agentId,
    });

    return conversation;
  });
}

/** Removes a conversation with its messages, notes and issues. */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { conversationId } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, agent: agentsVisibleTo(userId) },
      select: { id: true, agent: { select: { project: { select: { organizationId: true } } } } },
    });
    if (!conversation) throw new HttpError(404, "That conversation no longer exists.");
    await prisma.conversation.delete({ where: { id: conversationId } });
    await audit({
      organizationId: conversation.agent.project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "conversation.deleted",
      targetType: "conversation",
      targetId: conversationId,
    });
    return { ok: true };
  });
}
