import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { publishAdminEvent } from "@/lib/events";
import { refreshSummaryInBackground } from "@/lib/summarize";

export const runtime = "nodejs";

type Params = { params: Promise<{ conversationId: string }> };

const replySchema = z.object({
  message: z.string().trim().min(1, "Type a reply first.").max(8000),
  /** Name shown to the client. Falls back to the signed-in admin's. */
  authorName: z.string().trim().max(80).optional(),
  /**
   * Whether answering also takes the conversation over, silencing the agent
   * until it is handed back. Defaults to true - a colleague typing into a
   * transcript almost always means "I have got this".
   */
  takeOver: z.boolean().default(true),
});

/**
 * A colleague replying into the transcript from the inbox.
 *
 * The message is stored with role `human` and pushed straight to the client's
 * live feed, so it lands in their chat window exactly like an agent's reply
 * would - which is what turns an escalation from a dead end into a handover.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireAdmin();
    const { conversationId } = await params;
    const input = await parseJson(request, replySchema);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, agentId: true, replyMode: true },
    });
    if (!conversation) throw new HttpError(404, "That conversation no longer exists.");

    const authorName =
      input.authorName?.trim() ||
      session.email.split("@")[0] ||
      "A colleague";

    const message = await prisma.message.create({
      data: {
        conversationId,
        role: "human",
        content: input.message,
        authorName,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        ...(input.takeOver && conversation.replyMode !== "human"
          ? {
              replyMode: "human",
              takenOverBy: authorName,
              takenOverAt: new Date(),
              // A conversation a person is actively handling is open, whatever
              // it was before.
              status: "open",
            }
          : {}),
      },
    });

    if (input.takeOver && conversation.replyMode !== "human") {
    }
    publishAdminEvent({
      type: "conversation.updated",
      conversationId,
      agentId: conversation.agentId,
    });

    refreshSummaryInBackground(conversationId);

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      authorName,
      createdAt: message.createdAt.toISOString(),
    };
  });
}
