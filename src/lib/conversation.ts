/**
 * Resolving who is answering a conversation.
 *
 * `Conversation.agentId` is the agent the client contacted - it is half the
 * unique key and the chat link points at it, so it never moves. When a router
 * transfers, `activeAgentId` changes instead. Everything that needs "who is
 * answering right now" goes through here rather than reading either field
 * directly.
 */
import "server-only";
import { prisma } from "@/lib/db";

export type ActiveAgent = NonNullable<
  Awaited<ReturnType<typeof resolveActiveAgent>>
>;

export async function resolveActiveAgent(conversation: {
  agentId: string;
  activeAgentId: string | null;
}) {
  const id = conversation.activeAgentId ?? conversation.agentId;
  const agent = await prisma.agent.findUnique({ where: { id } });

  // The colleague a conversation was transferred to could have been deleted or
  // unpublished since. Fall back to the agent the client actually contacted
  // rather than stranding the conversation.
  if (!agent || agent.status !== "published") {
    if (conversation.activeAgentId) {
      const original = await prisma.agent.findUnique({
        where: { id: conversation.agentId },
      });
      if (original) return original;
    }
    return agent;
  }

  return agent;
}
