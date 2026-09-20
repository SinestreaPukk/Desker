import { prisma } from "@/lib/db";
import { handle, HttpError } from "@/lib/api";
import { toPublicAgent, type MessageDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

/** Passcodes travel in a header, never a query string that ends up in logs. */
const PASSCODE_HEADER = "x-desker-passcode";

/**
 * Public: the agent's display card plus this session's transcript, so a client
 * who reloads the page (or reopens the widget) picks up where they left off.
 * No account, no cookie - just the session id their browser stored.
 *
 * Doubles as the passcode check: a protected agent returns its public card to
 * anyone (so the gate can render) but releases the transcript only to a request
 * carrying the right passcode.
 */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { agentId } = await params;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const passcode = request.headers.get(PASSCODE_HEADER);

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        department: true,
        avatarUrl: true,
        welcomeMessage: true,
        publicPasscode: true,
        status: true,
      },
    });

    if (!agent || agent.status !== "published") {
      throw new HttpError(404, "This chat is no longer available.");
    }

    const card = toPublicAgent(agent);

    if (agent.publicPasscode) {
      // No passcode offered: hand back only what the gate needs to render.
      if (passcode === null) return { agent: card, messages: [] as MessageDto[] };
      if (passcode !== agent.publicPasscode) {
        throw new HttpError(401, "That passcode isn't right.");
      }
    }

    let messages: MessageDto[] = [];
    let handledByHuman = false;
    if (sessionId) {
      const conversation = await prisma.conversation.findUnique({
        where: { agentId_clientSessionId: { agentId, clientSessionId: sessionId } },
        select: {
          replyMode: true,
          messages: {
            // Tool turns are internal bookkeeping, not part of the client's view.
            // `human` turns are: they are a colleague talking to this client.
            where: { role: { in: ["user", "assistant", "human"] } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              content: true,
              authorName: true,
              rating: true,
              createdAt: true,
            },
          },
        },
      });
      handledByHuman = conversation?.replyMode === "human";
      messages = (conversation?.messages ?? [])
        .filter((message) => message.content.trim())
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          authorName: message.authorName,
          rating: message.rating,
          createdAt: message.createdAt.toISOString(),
        }));
    }

    return { agent: card, messages, handledByHuman };
  });
}
