import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { publishAdminEvent } from "@/lib/events";

export const runtime = "nodejs";

type Params = { params: Promise<{ conversationId: string }> };

const modeSchema = z.object({ mode: z.enum(["agent", "human"]) });

/**
 * Takes a conversation over, or hands it back to the agent.
 *
 * While `mode` is human the AI does not answer: client messages are recorded
 * and surfaced in the inbox, and a person replies. Handing back re-arms the
 * agent, which sees the colleague's replies as part of the history.
 */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireAdmin();
    const { conversationId } = await params;
    const input = await parseJson(request, modeSchema);

    const conversation = await prisma.conversation
      .update({
        where: { id: conversationId },
        data: {
          replyMode: input.mode,
          ...(input.mode === "human"
            ? {
                takenOverBy: session.email.split("@")[0] ?? "A colleague",
                takenOverAt: new Date(),
              }
            : { takenOverBy: null, takenOverAt: null }),
        },
        select: { id: true, agentId: true, replyMode: true, takenOverBy: true },
      })
      .catch(() => {
        throw new HttpError(404, "That conversation no longer exists.");
      });

    publishAdminEvent({
      type: "conversation.updated",
      conversationId,
      agentId: conversation.agentId,
    });

    return conversation;
  });
}
