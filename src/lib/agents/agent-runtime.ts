/**
 * One chat turn, end to end.
 *
 * Loads the agent and its conversation history, assembles the system prompt,
 * picks the provider, runs the streamed tool loop, and persists every turn.
 * The owner's chat with their assistant (the builder's preview pane) goes
 * through here.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { publishAdminEvent } from "@/lib/platform/events";
import { toStringArray } from "@/lib/agents/agent-fields";
import { buildPrompt } from "@/lib/agents/agent-prompt";
import { effectiveContext } from "@/lib/work/context";
import { rulesFor } from "@/lib/work/rules";
import {
  getProvider,

  type ChatEvent,
  type ChatMessage,
  type ToolCall,
} from "@/lib/llm/provider";
import { toolDefinitionsFor } from "@/lib/tools/registry";
import { WEB_CHAT_NOTE, WEB_SEARCH, webSearch } from "@/lib/agents/chat-web";
import { CALENDAR_CHAT_NOTE, CHECK_CALENDAR, checkCalendar } from "@/lib/agents/chat-calendar";
import { timeNote, validTimeZone } from "@/lib/shared/local-time";
import { audit } from "@/lib/platform/audit";
import { WORK_TOOL_IDS, scopeTools } from "@/lib/work/tools";
import { executeToolCall, type ToolOutcome } from "@/lib/tools/execute";

/** What the transport layer forwards to the browser. */
export type RuntimeEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; id: string }
  | { type: "tool_end"; name: string; id: string; effect?: ToolOutcome["effect"] }
  /** The saved id of the reply just streamed, so the client can rate it. */
  | { type: "persisted"; messageId: string }
  | { type: "done" }
  | { type: "error"; message: string; retryable: boolean };

interface AgentForRun {
  id: string;
  projectId: string;
  name: string;
  jobTitle: string;
  department: string | null;
  personality: string;
  responsibilities: unknown;
  allowedTools: unknown;
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
  agent: AgentForRun;
  conversationId: string;
  userMessage: string;
  /** Preview runs skip persistence and admin notifications. */
  persist: boolean;
  signal?: AbortSignal;
}

export async function* runAgentTurn(
  options: RunTurnOptions,
): AsyncGenerator<RuntimeEvent> {
  const { agent, conversationId, userMessage, persist, signal } = options;

  const allowedTools = Array.from(new Set([...toStringArray(agent.allowedTools), "search_documents"]));
  const responsibilities = toStringArray(agent.responsibilities);

  const [project, historyRows, documents, scope, rules] = await Promise.all([
    // The tenant to bill this turn to. An agent whose project is gone cannot
    // answer, so a missing project is an error rather than a free turn.
    prisma.project.findUniqueOrThrow({
      where: { id: agent.projectId },
      select: { organizationId: true, context: true },
    }),
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, blocks: true },
    }),
    allowedTools.includes("search_documents")
      ? prisma.document.findMany({
          where: { agentId: agent.id, status: "ready" },
          select: { filename: true },
        })
      : Promise.resolve([]),
    prisma.scopeOfWork.findUnique({
      where: { agentId: agent.id },
      select: { context: true, tools: true, timezone: true },
    }),
    rulesFor(agent.id),
  ]);

  // Nothing uploaded means nothing to search: offering the tool anyway only
  // buys empty lookups for context that is already in the system prompt.
  const offeredTools =
    documents.length > 0
      ? allowedTools
      : allowedTools.filter((tool) => tool !== "search_documents");

  // The owner's own chat can read the calendar when this agent's runs may.
  const calendarInChat = (scope ? (scopeTools(scope.tools) ?? [...WORK_TOOL_IDS]) : []).includes("calendar_list_events");

  const companyContext = effectiveContext({
    projectContext: project.context,
    agentContext: scope?.context,
  });

  const { stable: systemPrompt, volatile: volatilePrompt } = buildPrompt({
    name: agent.name,
    jobTitle: agent.jobTitle,
    personality: agent.personality,
    responsibilities,
    allowedTools: offeredTools,
    documentNames: documents.map((document) => document.filename),
    aboutPerson: companyContext,
    rules,
    // This chat can search the web (and read the calendar), so the generic "no tools" text must not say otherwise.
    abilities: `## What you can do\n${WEB_CHAT_NOTE.replace(/^## .*\n/, "")}${calendarInChat ? `\n\n${CALENDAR_CHAT_NOTE.replace(/^## .*\n/, "")}` : ""}${offeredTools.includes("search_documents") ? "\nYou can also search the owner's uploaded documents." : ""}`,
    volatile: [timeNote(new Date(), scope?.timezone)],
  });

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
    if (call.name === WEB_SEARCH.name) {
      const result = await webSearch(
        { organizationId: project.organizationId, agentId: agent.id, modelProvider: agent.modelProvider, model: agent.model },
        call.input,
      ).catch((error: unknown) => ({
        content: `The search failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isError: true,
      }));
      await audit({
        organizationId: project.organizationId,
        actorType: "agent",
        actorId: agent.id,
        action: "tool.called",
        targetType: "conversation",
        targetId: conversationId,
        metadata: { tool: WEB_SEARCH.name, ok: !result.isError, trigger: "conversation", result: result.content.slice(0, 600) },
      });
      return result;
    }
    if (calendarInChat && call.name === CHECK_CALENDAR.name) {
      const result = await checkCalendar(project.organizationId, call.input, validTimeZone(scope?.timezone)).catch((error: unknown) => ({
        content: `The calendar could not be read: ${error instanceof Error ? error.message : "unknown error"}`,
        isError: true,
      }));
      await audit({
        organizationId: project.organizationId,
        actorType: "agent",
        actorId: agent.id,
        action: "tool.called",
        targetType: "conversation",
        targetId: conversationId,
        metadata: { tool: CHECK_CALENDAR.name, ok: !result.isError, trigger: "conversation", result: result.content.slice(0, 600) },
      });
      return result;
    }
    // Preview conversations carry a `preview:` session prefix.
    const outcome = await executeToolCall(
      call,
      {
        agentId: agent.id,
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
      volatilePrompt,
      messages,
      tools: [...toolDefinitionsFor(offeredTools), ...(calendarInChat ? [CHECK_CALENDAR] : []), WEB_SEARCH],
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
  }

  if (!sawError) yield { type: "done" };
}
