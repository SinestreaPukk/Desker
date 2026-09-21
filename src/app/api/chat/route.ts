import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { chatRequestSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { canAcceptClientMessage } from "@/lib/billing/limits";
import { audit } from "@/lib/audit";
import { runAgentTurn } from "@/lib/agent-runtime";
import { resolveActiveAgent } from "@/lib/conversation";
import { publishAdminEvent } from "@/lib/events";
import { sseResponse } from "@/lib/sse";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** One audit row per organisation per hour is enough to tell the owner; more is noise. */
const refusalNoted = new Map<string, number>();
function shouldRecordRefusal(organizationId: string): boolean {
  const last = refusalNoted.get(organizationId) ?? 0;
  if (Date.now() - last < 60 * 60_000) return false;
  refusalNoted.set(organizationId, Date.now());
  return true;
}
export const dynamic = "force-dynamic";
// Tool loops with retrieval can legitimately take a while.
export const maxDuration = 120;

/** CORS preflight for the embedded widget on a third-party origin. */
export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, chatRequestSchema);

    if (!env.hasAnthropicKey && !env.hasOpenAiKey) {
      throw new HttpError(
        503,
        "This deployment has no model API key configured. Set ANTHROPIC_API_KEY and restart.",
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
    if (!agent) throw new HttpError(404, "This chat is no longer available.");

    // Draft agents are not reachable from the public surface at all - the same
    // 404 as a missing agent, so the link does not leak that a draft exists.
    if (agent.status !== "published") {
      throw new HttpError(404, "This chat is no longer available.");
    }

    if (agent.publicPasscode && input.passcode !== agent.publicPasscode) {
      throw new HttpError(401, "That passcode isn't right.");
    }

    // Keyed per agent+session: one abusive session cannot exhaust another's quota.
    const limit = checkRateLimit(`chat:${agent.id}:${input.sessionId}`);
    if (!limit.allowed) {
      throw new HttpError(
        429,
        `You are sending messages faster than this chat allows. Try again in ${limit.retryAfterSeconds}s.`,
      );
    }

    // The organisation's plan, enforced on the public surface. A client only
    // ever sees "unavailable"; the reason goes to the owner's audit log.
    const owner = await prisma.project.findUniqueOrThrow({
      where: { id: agent.projectId },
      select: { organizationId: true },
    });
    const existingConversation = await prisma.conversation.findUnique({
      where: { agentId_clientSessionId: { agentId: agent.id, clientSessionId: input.sessionId } },
      select: { id: true },
    });
    const quota = await canAcceptClientMessage(owner.organizationId, !existingConversation);
    if (!quota.allowed) {
      if (shouldRecordRefusal(owner.organizationId)) {
        await audit({
          organizationId: owner.organizationId,
          actorType: "system",
          action: "conversation.refused",
          targetType: "agent",
          targetId: agent.id,
          metadata: { reason: quota.reason },
        });
      }
      throw new HttpError(
        503,
        "This assistant is temporarily unavailable. Please try again later.",
      );
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        agentId_clientSessionId: {
          agentId: agent.id,
          clientSessionId: input.sessionId,
        },
      },
      create: { agentId: agent.id, clientSessionId: input.sessionId },
      update: {},
    });

    // A colleague has taken the conversation over: record what the client said
    // and notify the dashboard, but do not let the AI answer over them.
    if (conversation.replyMode === "human") {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: input.message,
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
      publishAdminEvent({
        type: "conversation.updated",
        conversationId: conversation.id,
        agentId: agent.id,
      });

      // The client's own message arrives back over their live feed, so the
      // turn ends here with nothing to stream.
      return sseResponse(
        (async function* () {
          yield { type: "handled_by_human" as const };
          yield { type: "done" as const };
        })(),
        { signal: request.signal },
      );
    }

    // A router may have handed this conversation to a colleague; the client's
    // link still points at the agent they first contacted.
    const active = (await resolveActiveAgent(conversation)) ?? agent;

    return sseResponse(
      runAgentTurn({
        agent: active,
        conversationId: conversation.id,
        clientSessionId: input.sessionId,
        userMessage: input.message,
        persist: true,
        signal: request.signal,
      }),
      { signal: request.signal },
    );
  });
}
