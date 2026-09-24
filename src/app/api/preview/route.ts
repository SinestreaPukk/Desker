import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { previewRequestSchema } from "@/lib/validation";
import { runAgentTurn } from "@/lib/agent-runtime";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Builder collaboration chat. Allows platform users to chat directly with the
 * agent as a teammate - performing tasks within their role (researching, drafting,
 * coding, analyzing), finding answers grounded in company context, and testing
 * capabilities, rather than simulating an external client chat.
 *
 * Preview conversations are real rows (the runtime needs somewhere to store
 * history) but are marked resolved and excluded from the inbox by default.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const input = await parseJson(request, previewRequestSchema);

    const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const clientSessionId = `preview:${input.previewId}`;
    const conversation = await prisma.conversation.upsert({
      where: {
        agentId_clientSessionId: { agentId: agent.id, clientSessionId },
      },
      create: { agentId: agent.id, clientSessionId, status: "resolved" },
      update: {},
    });

    return sseResponse(
      runAgentTurn({
        agent,
        conversationId: conversation.id,
        userMessage: input.message,
        persist: true,
        signal: request.signal,
        mode: "colleague",
      }),
      { signal: request.signal },
    );
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const previewId = new URL(request.url).searchParams.get("previewId");
    if (!previewId) throw new HttpError(400, "previewId is required.");

    await prisma.conversation.deleteMany({
      where: { clientSessionId: `preview:${previewId}` },
    });
    return { ok: true };
  });
}
