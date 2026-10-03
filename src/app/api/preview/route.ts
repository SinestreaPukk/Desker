import { prisma } from "@/lib/platform/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { previewRequestSchema } from "@/lib/shared/validation";
import { runAgentTurn } from "@/lib/agents/agent-runtime";
import { agentsVisibleTo, findAgentFor } from "@/lib/tenancy/projects";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { sseResponse } from "@/lib/platform/sse";

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
    const { userId } = await requireAdmin();
    const input = await parseJson(request, previewRequestSchema);

    // Only an agent in one of the caller's own organisations: a preview runs in
    // colleague mode, with the company context and documents in reach.
    const agent = await findAgentFor(input.agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");
    await limitOrganization(agent.project.organizationId, "model");

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
      }),
      { signal: request.signal },
    );
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const previewId = new URL(request.url).searchParams.get("previewId");
    if (!previewId) throw new HttpError(400, "previewId is required.");

    await prisma.conversation.deleteMany({
      where: { clientSessionId: `preview:${previewId}`, agent: agentsVisibleTo(userId) },
    });
    return { ok: true };
  });
}
