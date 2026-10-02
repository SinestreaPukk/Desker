/**
 * Tool execution. This is where a model's intent turns into a database row.
 *
 * Every handler validates its own input: the model is a caller like any other,
 * and `strict` is not enabled on these tools, so arguments may be missing or
 * the wrong shape.
 */
import "server-only";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import type { ToolCall } from "@/lib/llm/provider";
import { searchDocuments } from "@/lib/rag/search-documents";
import { SEARCH_DOCUMENTS, searchDocumentsInput } from "@/lib/rag/search-documents-tool";
import { isToolId } from "./registry";

interface ToolContext {
  /** The agent currently answering - the one whose tools these are. */
  agentId: string;
  /** The tenant the audit row belongs to. Omitted only in unit tests. */
  organizationId?: string;
  conversationId: string;
}

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  /** Side effects the transport layer forwards to the browser for live UI. */
  effect?: { kind: "search"; query: string; hits: number };
}

function invalidInput(toolName: string, error: z.ZodError): ToolOutcome {
  const detail = error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
  return {
    content: `Invalid arguments for ${toolName} (${detail}). Fix the arguments and call the tool again.`,
    isError: true,
  };
}

async function searchDocumentsTool(input: unknown, context: ToolContext): Promise<ToolOutcome> {
  const parsed = searchDocumentsInput.safeParse(input);
  if (!parsed.success) return invalidInput(SEARCH_DOCUMENTS, parsed.error);
  const result = await searchDocuments({
    agentId: context.agentId,
    conversationId: context.conversationId,
    query: parsed.data.query,
  });
  return { content: result.content, effect: { kind: "search", query: parsed.data.query, hits: result.hits } };
}

export async function executeToolCall(
  call: ToolCall,
  context: ToolContext,
  allowedTools: string[],
): Promise<ToolOutcome> {
  const outcome = await dispatch(call, context, allowedTools);
  // Every tool call is on the record, whether it worked or was refused.
  if (context.organizationId) {
    await audit({
      organizationId: context.organizationId,
      actorType: "agent",
      actorId: context.agentId,
      action: "tool.called",
      targetType: "conversation",
      targetId: context.conversationId,
      metadata: {
        tool: call.name,
        ok: !outcome.isError,
        trigger: "conversation",
        input: trimForAudit(call.input) as Prisma.InputJsonValue,
        result: outcome.content.slice(0, 600),
      },
    });
  }
  return outcome;
}

function trimForAudit(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 300 ? `${value.slice(0, 300)}…` : value,
    ]),
  );
}

async function dispatch(
  call: ToolCall,
  context: ToolContext,
  allowedTools: string[],
): Promise<ToolOutcome> {
  if (!isToolId(call.name)) {
    return { content: `Unknown tool "${call.name}".`, isError: true };
  }
  // The permission list is enforced here, not only by omitting the definition:
  // a model can hallucinate a tool name it was never given.
  if (!allowedTools.includes(call.name)) {
    return {
      content: `You are not permitted to use ${call.name} in this role.`,
      isError: true,
    };
  }

  try {
    return await searchDocumentsTool(call.input, context);
  } catch (error) {
    return {
      content: `${call.name} failed: ${
        error instanceof Error ? error.message : "unexpected error"
      }. Tell the user you could not complete that action.`,
      isError: true,
    };
  }
}
