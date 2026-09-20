import { prisma } from "@/lib/db";
import { HttpError, jsonError } from "@/lib/api";
import { sseHeaders } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/** How often the open conversation is checked for turns the client has not seen. */
const POLL_MS = 1500;
/** Comment frames keep proxies from closing an idle stream. */
const HEARTBEAT_MS = 25_000;

/**
 * The client's live feed for one conversation.
 *
 * Without this an escalation is a dead end: the agent says "I've passed this to
 * a colleague" and the client never hears back, because nothing pushes a human
 * reply into their window. This is the channel that carries it.
 *
 * It tails the database rather than subscribing to the in-process event bus.
 * That bus is genuinely faster, but the production bundle emits a copy of the
 * module into each route's chunk, so a publisher in one route reached no
 * subscriber in another and replies silently never arrived. Reading committed
 * rows is immune to that, survives more than one instance, and is the same
 * query the client would run on reload - so the live path and the reload path
 * cannot disagree.
 *
 * Scoped to one conversation, resolved from the client's own session id, so a
 * client can only ever subscribe to their own thread.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { agentId } = await params;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) throw new HttpError(400, "sessionId is required.");

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true },
    });
    if (!agent || agent.status !== "published") {
      throw new HttpError(404, "This chat is no longer available.");
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        // Only turns created after the feed opens are pushed; everything before
        // it is already on screen from the initial load.
        let since = new Date();
        let lastReplyMode: string | null = null;

        const send = (payload: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            closed = true;
          }
        };

        send({ type: "ready" });

        const poll = async () => {
          if (closed) return;
          try {
            const conversation = await prisma.conversation.findUnique({
              where: {
                agentId_clientSessionId: { agentId, clientSessionId: sessionId },
              },
              select: {
                id: true,
                replyMode: true,
                messages: {
                  // The client's own messages are already in their window; what
                  // they are waiting for is an answer.
                  where: { createdAt: { gt: since }, role: { in: ["human", "assistant"] } },
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    role: true,
                    content: true,
                    authorName: true,
                    createdAt: true,
                  },
                },
              },
            });

            if (!conversation) return;

            if (lastReplyMode !== null && conversation.replyMode !== lastReplyMode) {
              send({
                type: "mode",
                conversationId: conversation.id,
                mode: conversation.replyMode,
              });
            }
            lastReplyMode = conversation.replyMode;

            for (const message of conversation.messages) {
              if (!message.content.trim()) continue;
              send({
                type: "message",
                conversationId: conversation.id,
                messageId: message.id,
                role: message.role,
                authorName: message.authorName,
                content: message.content,
                createdAt: message.createdAt.toISOString(),
              });
              since = message.createdAt;
            }
          } catch (error) {
            // A transient database hiccup must not kill the feed; the next tick
            // picks up whatever was missed, because the cursor has not moved.
            console.error("[chat live] poll failed", error);
          }
        };

        const ticker = setInterval(() => void poll(), POLL_MS);
        const heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            closed = true;
          }
        }, HEARTBEAT_MS);

        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(ticker);
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // Already closed by the client disconnecting.
          }
        };

        request.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    console.error("[chat live] failed", error);
    return jsonError(500, "Could not open the live feed.");
  }
}
