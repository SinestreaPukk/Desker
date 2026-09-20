/**
 * Rolling conversation summaries.
 *
 * Two jobs, one artefact:
 *   - the inbox becomes scannable, instead of forcing an admin to open every
 *     transcript to find out what happened;
 *   - a returning client stops being a stranger, because the summaries of their
 *     earlier conversations are handed to the agent as recall.
 *
 * Cost is the whole design constraint. A summary per turn would roughly double
 * the model spend, so this refreshes only when enough has been said to change
 * the answer, and runs in the background where nothing waits on it.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { getProvider, type ChatMessage } from "@/lib/llm/provider";
import { env } from "@/lib/env";

/** Messages that must accumulate before a stale summary is worth re-running. */
const REFRESH_AFTER_MESSAGES = 4;

const SYSTEM_PROMPT = `You summarise customer support conversations for the company's own staff.

Write 1-3 sentences, in plain past tense, covering:
- what the client wanted
- what was established or decided
- anything still outstanding

Rules:
- Be specific. Name the product, the order, the error, the amount.
- No preamble, no "the client asked about...", no bullet points. Just the summary.
- If the conversation is too short to summarise, reply with exactly: (nothing yet)`;

function transcriptOf(
  messages: { role: string; content: string; authorName: string | null }[],
): string {
  return messages
    .filter((message) => message.role !== "tool" && message.content.trim())
    .map((message) => {
      const who =
        message.role === "user"
          ? "Client"
          : message.role === "human"
            ? `${message.authorName ?? "Colleague"} (human)`
            : "Agent";
      return `${who}: ${message.content.trim()}`;
    })
    .join("\n");
}

/**
 * Regenerates the summary if it is stale. Safe to call after every turn -
 * it returns immediately when nothing has changed enough to matter.
 */
export async function refreshSummary(
  conversationId: string,
  options: { force?: boolean } = {},
): Promise<string | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      summary: true,
      summarizedAt: true,
      agent: {
        select: {
          id: true,
          modelProvider: true,
          model: true,
          project: { select: { organizationId: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, authorName: true, createdAt: true },
      },
    },
  });
  if (!conversation) return null;

  const spoken = conversation.messages.filter(
    (message) => message.role !== "tool" && message.content.trim(),
  );
  if (spoken.length < 2) return null;

  if (!options.force && conversation.summarizedAt) {
    const since = spoken.filter(
      (message) => message.createdAt > conversation.summarizedAt!,
    ).length;
    if (since < REFRESH_AFTER_MESSAGES) return conversation.summary;
  }

  if (!env.hasAnthropicKey && !env.hasOpenAiKey) return conversation.summary;

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Summarise this conversation:\n\n${transcriptOf(spoken)}`,
    },
  ];

  try {
    const provider = await getProvider(conversation.agent.modelProvider);
    let text = "";

    for await (const event of provider.streamChat({
      billing: {
        organizationId: conversation.agent.project.organizationId,
        agentId: conversation.agent.id,
      },
      systemPrompt: SYSTEM_PROMPT,
      messages,
      tools: [],
      executeTool: async () => ({ content: "" }),
      model: conversation.agent.model,
      maxTokens: 300,
    })) {
      if (event.type === "text_delta") text += event.text;
      if (event.type === "error") return conversation.summary;
    }

    const summary = text.trim();
    if (!summary || summary === "(nothing yet)") return conversation.summary;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary, summarizedAt: new Date() },
    });
    return summary;
  } catch (error) {
    // A failed summary is a cosmetic loss; never let it surface to a client.
    console.error("[summarize] failed:", error);
    return conversation.summary;
  }
}

export function refreshSummaryInBackground(conversationId: string): void {
  void refreshSummary(conversationId);
}

/**
 * What an agent is told about a returning client.
 *
 * Scoped to the client's session id *and* the project, so it covers the
 * conversations that browser has had inside this workspace - with this agent
 * and with its colleagues - and nothing else. It is deliberately not a
 * cross-client lookup: one browser's history is the only thing we can attribute
 * without an account.
 */
export async function recallForSession(
  clientSessionId: string,
  currentConversationId: string,
  projectId: string,
  limit = 3,
): Promise<string | null> {
  if (clientSessionId.startsWith("preview:")) return null;

  const previous = await prisma.conversation.findMany({
    where: {
      clientSessionId,
      id: { not: currentConversationId },
      summary: { not: null },
      // Same project only. One browser may have talked to two different
      // clients' agents; neither should learn about the other.
      agent: { projectId },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    select: {
      summary: true,
      lastMessageAt: true,
      agent: { select: { name: true } },
    },
  });

  if (previous.length === 0) return null;

  return previous
    .map((conversation) => {
      const when = conversation.lastMessageAt.toISOString().slice(0, 10);
      return `- ${when}, with ${conversation.agent.name}: ${conversation.summary}`;
    })
    .join("\n");
}
