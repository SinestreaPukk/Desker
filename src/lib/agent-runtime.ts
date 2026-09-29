/**
 * One chat turn, end to end.
 *
 * Loads the agent and its conversation history, assembles the system prompt,
 * picks the provider, runs the streamed tool loop, and persists every turn.
 * Both the public chat endpoint and the builder's preview pane go through here,
 * so the preview is genuinely the same code path the client hits - not a
 * lookalike that can drift.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { publishAdminEvent } from "@/lib/events";
import { toStringArray } from "@/lib/agent-fields";
import { buildSystemPrompt, buildCompanyContextPrompt } from "@/lib/agent-prompt";
import { effectiveContext } from "@/lib/work/context";
import { spaceKind } from "@/lib/space";
import { rulesFor } from "@/lib/work/rules";
import {
  getProvider,

  type ChatEvent,
  type ChatMessage,
  type ToolCall,
} from "@/lib/llm/provider";
import { toolDefinitionsFor } from "@/lib/tools/registry";
import { executeToolCall, type ToolOutcome } from "@/lib/tools/execute";
import { recallForSession, refreshSummaryInBackground } from "@/lib/summarize";

/** What the transport layer forwards to the browser. */
export type RuntimeEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; id: string }
  | { type: "tool_end"; name: string; id: string; effect?: ToolOutcome["effect"] }
  | { type: "transferred"; toAgentId: string; toAgentName: string }
  /** The saved id of the reply just streamed, so the client can rate it. */
  | { type: "persisted"; messageId: string }
  | { type: "done" }
  | { type: "error"; message: string; retryable: boolean };

interface AgentForRun {
  id: string;
  /** Scopes the colleague list: a router must never reach another project. */
  projectId: string;
  name: string;
  jobTitle: string;
  department: string | null;
  personality: string;
  responsibilities: unknown;
  allowedTools: unknown;
  escalationRule: string | null;
  modelProvider: string;
  model: string | null;
}

/** Rebuilds the neutral conversation history from persisted rows. */
function messagesFromRows(
  rows: { role: string; content: string; blocks: unknown }[],
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const row of rows) {
    if (row.role === "user") {
      messages.push({ role: "user", content: row.content });
      continue;
    }
    // A colleague's reply is part of what the client was told, so the agent has
    // to see it - as an assistant turn, since from the client's side it came
    // from the same conversation. It carries no tool calls to pair up.
    if (row.role === "human") {
      if (row.content.trim()) {
        messages.push({ role: "assistant", content: row.content });
      }
      continue;
    }
    // `blocks` holds the neutral ChatMessage payload written when the turn was
    // produced; it is what preserves tool_use/tool_result pairing on replay.
    if (row.blocks && typeof row.blocks === "object") {
      messages.push(row.blocks as ChatMessage);
      continue;
    }
    if (row.role === "assistant") {
      messages.push({ role: "assistant", content: row.content });
    }
  }

  // A trailing assistant turn with unanswered tool calls would be rejected by
  // the API. That can only happen if a stream died mid-turn; drop the stub.
  while (messages.length > 0) {
    const last = messages[messages.length - 1]!;
    if (last.role === "assistant" && last.toolCalls?.length) {
      messages.pop();
      continue;
    }
    break;
  }

  return messages;
}

function renderToolTurn(results: { name: string; content: string }[]): string {
  return results.map((result) => `${result.name}: ${result.content}`).join("\n\n");
}

interface RunTurnOptions {
  /** The agent actually answering. See resolveActiveAgent(). */
  agent: AgentForRun;
  conversationId: string;
  /** The client's session id, used to recall their earlier conversations. */
  clientSessionId?: string;
  userMessage: string;
  /** Preview runs skip persistence and admin notifications. */
  persist: boolean;
  signal?: AbortSignal;
  /**
   * "client": Live client conversation turn (default).
   * "colleague": Platform user chatting/collaborating with their agent as a coworker.
   * "company_context": Legacy platform user asking company-context questions.
   */
  mode?: "client" | "colleague" | "company_context";
}

export async function* runAgentTurn(
  options: RunTurnOptions,
): AsyncGenerator<RuntimeEvent> {
  const { agent, conversationId, userMessage, persist, signal, mode = "client" } = options;
  const isCompanyContext = mode === "company_context";
  const isColleague = mode === "colleague";

  const rawTools = toStringArray(agent.allowedTools);
  const allowedTools = isCompanyContext
    ? ["search_documents"]
    : isColleague
      ? Array.from(new Set([...rawTools, "search_documents"]))
      : rawTools;
  const responsibilities = toStringArray(agent.responsibilities);

  const [project, historyRows, documents, colleagues, recall, scope, rules] = await Promise.all([
    // The tenant to bill this turn to. An agent whose project is gone cannot
    // answer, so a missing project is an error rather than a free turn.
    prisma.project.findUniqueOrThrow({
      where: { id: agent.projectId },
      select: { organizationId: true, context: true, organization: { select: { kind: true } } },
    }),
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, blocks: true },
    }),
    isCompanyContext || allowedTools.includes("search_documents")
      ? prisma.document.findMany({
          where: { agentId: agent.id, status: "ready" },
          select: { filename: true },
        })
      : Promise.resolve([]),
    !isCompanyContext && (isColleague || allowedTools.includes("transfer_to_agent"))
      ? prisma.agent.findMany({
          // Same project only. Offering another client's roster would be a
          // data leak, not merely a bad routing decision.
          where: {
            status: "published",
            projectId: agent.projectId,
            id: { not: agent.id },
          },
          select: { id: true, name: true, jobTitle: true, department: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    !isCompanyContext && options.clientSessionId
      ? recallForSession(options.clientSessionId, conversationId, agent.projectId)
      : Promise.resolve(null),
    prisma.scopeOfWork.findUnique({
      where: { agentId: agent.id },
      select: { context: true },
    }),
    rulesFor(agent.id),
  ]);

  // Nothing uploaded means nothing to search: offering the tool anyway only
  // buys empty lookups for context that is already in the system prompt.
  const offeredTools =
    documents.length > 0
      ? allowedTools
      : allowedTools.filter((tool) => tool !== "search_documents");

  const kind = spaceKind(project.organization.kind);
  const companyContext = effectiveContext({
    projectContext: project.context,
    agentContext: scope?.context,
    kind,
  });

  let systemPrompt: string;
  if (isCompanyContext) {
    systemPrompt = buildCompanyContextPrompt({
      name: agent.name,
      jobTitle: agent.jobTitle,
      department: agent.department,
      personality: agent.personality,
      companyContext,
      documentNames: documents.map((document) => document.filename),
      kind,
      rules,
    });
  } else {
    systemPrompt = buildSystemPrompt({
      name: agent.name,
      jobTitle: agent.jobTitle,
      department: agent.department,
      personality: agent.personality,
      responsibilities,
      escalationRule: agent.escalationRule,
      allowedTools: offeredTools,
      documentNames: documents.map((document) => document.filename),
      colleagues,
      recall,
      companyContext,
      audience: isColleague ? "colleague" : "client",
      kind,
      rules,
    });
  }

  const history = messagesFromRows(historyRows);
  const messages: ChatMessage[] = [...history, { role: "user", content: userMessage }];

  if (persist) {
    await prisma.message.create({
      data: { conversationId, role: "user", content: userMessage },
    });
  }

  // Side effects captured during tool execution, replayed to the browser after
  // the provider reports the corresponding tool result.
  const effects = new Map<string, ToolOutcome["effect"]>();

  const executeTool = async (call: ToolCall) => {
    // Preview runs execute the real tools too - an admin testing an escalation
    // rule needs to see it actually fire. Preview conversations carry a
    // `preview:` session prefix and are filtered out of the inbox by default.
    const outcome = await executeToolCall(
      call,
      {
        agentId: agent.id,
        projectId: agent.projectId,
        organizationId: project.organizationId,
        conversationId,
      },
      offeredTools,
    );
    effects.set(call.id, outcome.effect);
    return { content: outcome.content, ...(outcome.isError ? { isError: true } : {}) };
  };

  const provider = await getProvider(agent.modelProvider);

  let stream: AsyncIterable<ChatEvent>;
  try {
    stream = provider.streamChat({
      billing: { organizationId: project.organizationId, agentId: agent.id },
      systemPrompt,
      messages,
      tools: toolDefinitionsFor(offeredTools),
      executeTool,
      model: agent.model,
      signal,
    });
  } catch (error) {
    yield {
      type: "error",
      message:
        error instanceof Error ? error.message : "Could not start the model request.",
      retryable: false,
    };
    return;
  }

  let sawError = false;

  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        yield { type: "text", text: event.text };
        break;

      case "tool_call":
        yield { type: "tool_start", name: event.call.name, id: event.call.id };
        break;

      case "tool_result": {
        const effect = effects.get(event.result.id);
        yield {
          type: "tool_end",
          name: event.result.name,
          id: event.result.id,
          effect,
        };
        // Tell the client's UI who they are now talking to, so the header and
        // the avatar change mid-conversation rather than at the next reload.
        if (effect?.kind === "transfer") {
          yield {
            type: "transferred",
            toAgentId: effect.toAgentId,
            toAgentName: effect.toAgentName,
          };
        }
        break;
      }

      case "turn":
        if (persist) {
          const saved = await prisma.message.create({
            data: {
              conversationId,
              role: "assistant",
              content: event.message.content,
              blocks: event.message as unknown as object,
            },
            select: { id: true },
          });
          // Only a turn with something to read is worth rating; a bare
          // tool-call turn has no text on screen.
          if (event.message.content.trim()) {
            yield { type: "persisted", messageId: saved.id };
          }
        }
        break;

      case "tool_turn":
        if (persist) {
          await prisma.message.create({
            data: {
              conversationId,
              role: "tool",
              content: renderToolTurn(event.message.results),
              blocks: event.message as unknown as object,
            },
          });
        }
        break;

      case "error":
        sawError = true;
        yield { type: "error", message: event.message, retryable: event.retryable };
        break;

      case "done":
        break;
    }
  }

  if (persist) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    publishAdminEvent({
      type: "conversation.updated",
      conversationId,
      agentId: agent.id,
    });
    // Keeps the inbox scannable and feeds the recall a returning client gets.
    // Throttled inside, and nothing waits on it.
    refreshSummaryInBackground(conversationId);
  }

  if (!sawError) yield { type: "done" };
}
