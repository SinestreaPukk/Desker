import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(8).max(128),
  messageId: z.string().min(1),
  /** 1 helpful, -1 not helpful, 0 clears an earlier rating. */
  rating: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

/**
 * A client rating a reply. Public, no account - so the only thing that ties a
 * rating to a message is that the message belongs to *this session's* own
 * conversation, which is checked before anything is written.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, feedbackSchema);

    const message = await prisma.message.findFirst({
      where: {
        id: input.messageId,
        role: { in: ["assistant", "human"] },
        conversation: { agentId: input.agentId, clientSessionId: input.sessionId },
      },
      select: { id: true },
    });
    if (!message) throw new HttpError(404, "That message isn't in your conversation.");

    await prisma.message.update({
      where: { id: message.id },
      data: {
        rating: input.rating === 0 ? null : input.rating,
        ratedAt: input.rating === 0 ? null : new Date(),
      },
    });

    return { ok: true, rating: input.rating === 0 ? null : input.rating };
  });
}
