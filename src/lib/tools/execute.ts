/**
 * Tool execution. This is where a model's intent turns into a database row.
 *
 * Every handler validates its own input: the model is a caller like any other,
 * and `strict` is not enabled on these tools, so arguments may be missing or
 * the wrong shape.
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { publishAdminEvent } from "@/lib/events";
import { notifyInBackground } from "@/lib/notify";
import type { ToolCall } from "@/lib/llm/provider";
import { retrieveContext } from "@/lib/rag/retriever";
import { SEVERITIES, isToolId, type ToolId } from "./registry";

export interface ToolContext {
  /** The agent currently answering - the one whose tools these are. */
  agentId: string;
  /** Scopes a transfer: the target must be in the same project. */
  projectId?: string;
  conversationId: string;
}

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  /** Side effects the transport layer forwards to the client for live UI. */
  effect?:
    | { kind: "issue"; id: string; type: "issue" | "suggestion"; summary: string }
    | { kind: "escalation"; reason: string }
    | { kind: "search"; query: string; hits: number }
    | { kind: "transfer"; toAgentId: string; toAgentName: string; reason: string };
}

const searchSchema = z.object({ query: z.string().min(1).max(500) });

const issueSchema = z.object({
  summary: z.string().min(1).max(300),
  severity: z.enum(SEVERITIES).catch("medium"),
  details: z.string().max(5000).default(""),
});

const suggestionSchema = z.object({
  summary: z.string().min(1).max(300),
  details: z.string().max(5000).default(""),
});

const escalateSchema = z.object({ reason: z.string().min(1).max(2000) });

const transferSchema = z.object({
  agent_id: z.string().trim().min(1).max(64),
  reason: z.string().min(1).max(2000),
});

function invalidInput(toolName: string, error: z.ZodError): ToolOutcome {
  const detail = error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
  return {
    content: `Invalid arguments for ${toolName} (${detail}). Fix the arguments and call the tool again.`,
    isError: true,
  };
}

async function searchCompanyContext(
  input: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return invalidInput("search_company_context", parsed.error);

  const hits = await retrieveContext(context.agentId, parsed.data.query);

  // Recorded whether or not it found anything: the misses are the useful half,
  // because they are the questions the uploaded documents cannot answer.
  await prisma.retrievalLog
    .create({
      data: {
        agentId: context.agentId,
        conversationId: context.conversationId,
        query: parsed.data.query,
        hitCount: hits.length,
      },
    })
    .catch((error: unknown) => {
      console.error("[tools] retrieval log failed", error);
    });

  if (hits.length === 0) {
    return {
      content:
        "No relevant passages found in the uploaded documents for that query. Try a different " +
        "phrasing, or tell the client you do not have that information rather than guessing.",
      effect: { kind: "search", query: parsed.data.query, hits: 0 },
    };
  }

  const body = hits
    .map(
      (hit, index) =>
        `[${index + 1}] source: ${hit.filename} (chunk ${hit.chunkIndex + 1})\n${hit.content}`,
    )
    .join("\n\n---\n\n");

  return {
    content: `${hits.length} relevant passage(s):\n\n${body}`,
    effect: { kind: "search", query: parsed.data.query, hits: hits.length },
  };
}

async function logIssue(input: unknown, context: ToolContext): Promise<ToolOutcome> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return invalidInput("log_issue", parsed.error);

  const issue = await prisma.issue.create({
    data: {
      conversationId: context.conversationId,
      type: "issue",
      summary: parsed.data.summary,
      severity: parsed.data.severity,
      details: parsed.data.details || null,
    },
  });

  publishAdminEvent({
    type: "issue.created",
    conversationId: context.conversationId,
    agentId: context.agentId,
    issueType: "issue",
  });

  // Only the severities a person would want to be interrupted for. Logging
  // every cosmetic bug to a chat channel is how notifications get muted.
  if (parsed.data.severity === "critical" || parsed.data.severity === "high") {
    const agent = await prisma.agent.findUnique({
      where: { id: context.agentId },
      select: { name: true },
    });
    notifyInBackground({
      kind: "critical_issue",
      title:
        parsed.data.severity === "critical"
          ? "Critical issue logged"
          : "High-severity issue logged",
      body: parsed.data.summary,
      agentName: agent?.name ?? "An agent",
      conversationId: context.conversationId,
      severity: parsed.data.severity,
    });
  }

  return {
    content:
      `Issue logged (reference ${issue.id.slice(-6).toUpperCase()}, severity ${parsed.data.severity}). ` +
      "It is now visible to the team. Tell the client it has been recorded.",
    effect: {
      kind: "issue",
      id: issue.id,
      type: "issue",
      summary: parsed.data.summary,
    },
  };
}

async function logSuggestion(
  input: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) return invalidInput("log_suggestion", parsed.error);

  const issue = await prisma.issue.create({
    data: {
      conversationId: context.conversationId,
      type: "suggestion",
      summary: parsed.data.summary,
      details: parsed.data.details || null,
    },
  });

  publishAdminEvent({
    type: "issue.created",
    conversationId: context.conversationId,
    agentId: context.agentId,
    issueType: "suggestion",
  });

  return {
    content:
      `Suggestion logged (reference ${issue.id.slice(-6).toUpperCase()}). ` +
      "Tell the client it has been passed on to the team.",
    effect: {
      kind: "issue",
      id: issue.id,
      type: "suggestion",
      summary: parsed.data.summary,
    },
  };
}

/**
 * Condenses a reason into a scannable one-line summary.
 *
 * The inbox shows `summary` in bold and `details` beneath it, so storing the
 * same sentence in both prints it twice. Take the first sentence as the
 * headline and keep the rest for the body.
 */
function splitReason(reason: string): { summary: string; details: string | null } {
  const trimmed = reason.trim();
  const match = trimmed.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);

  if (match && match[1]!.length <= 160) {
    return { summary: match[1]!, details: match[2]!.trim() || null };
  }
  if (trimmed.length <= 160) return { summary: trimmed, details: null };

  // No sentence break to cut on: truncate at a word boundary and keep the whole
  // reason as the body, since the headline is now lossy.
  const clipped = trimmed.slice(0, 160);
  const boundary = clipped.lastIndexOf(" ");
  return {
    summary: `${(boundary > 80 ? clipped.slice(0, boundary) : clipped).trimEnd()}…`,
    details: trimmed,
  };
}

async function escalateToHuman(
  input: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const parsed = escalateSchema.safeParse(input);
  if (!parsed.success) return invalidInput("escalate_to_human", parsed.error);

  await prisma.conversation.update({
    where: { id: context.conversationId },
    data: { status: "escalated" },
  });

  // Recorded alongside issues and suggestions so the inbox is one list of
  // things needing a human, but under its own type so the dashboard can show
  // it for what it is rather than as an issue with a prefix glued on.
  const { summary, details } = splitReason(parsed.data.reason);
  await prisma.issue.create({
    data: {
      conversationId: context.conversationId,
      type: "escalation",
      summary,
      severity: "high",
      details,
    },
  });

  publishAdminEvent({
    type: "conversation.escalated",
    conversationId: context.conversationId,
    agentId: context.agentId,
  });

  const escalatingAgent = await prisma.agent.findUnique({
    where: { id: context.agentId },
    select: { name: true },
  });
  notifyInBackground({
    kind: "escalation",
    title: "Conversation escalated",
    body: parsed.data.reason,
    agentName: escalatingAgent?.name ?? "An agent",
    conversationId: context.conversationId,
  });

  return {
    content:
      "This conversation has been flagged for a human colleague, who can see the full transcript. " +
      "Tell the client you have handed it over and roughly what happens next. Do not imply a " +
      "human is already reading.",
    effect: { kind: "escalation", reason: parsed.data.reason },
  };
}

async function transferToAgent(
  input: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return invalidInput("transfer_to_agent", parsed.error);

  if (parsed.data.agent_id === context.agentId) {
    return {
      content:
        "That is you. Either answer the client yourself or transfer to a different colleague.",
      isError: true,
    };
  }

  const target = await prisma.agent.findUnique({
    where: { id: parsed.data.agent_id },
    select: { id: true, name: true, jobTitle: true, status: true, projectId: true },
  });

  // Enforced here and not only by what the prompt lists: a model can name an id
  // it was never given, and crossing a project boundary would hand one client's
  // conversation to another client's agent.
  const sameProject = !context.projectId || target?.projectId === context.projectId;

  if (!target || target.status !== "published" || !sameProject) {
    return {
      content:
        `No colleague with id "${parsed.data.agent_id}" is available. Use an id exactly as ` +
        "listed in your colleagues, or escalate to a human instead.",
      isError: true,
    };
  }

  await prisma.conversation.update({
    where: { id: context.conversationId },
    data: { activeAgentId: target.id },
  });

  // Recorded in the transcript so the handover is visible to the colleague
  // picking it up and to the admin reading it later.
  await prisma.message.create({
    data: {
      conversationId: context.conversationId,
      role: "tool",
      content: `transfer_to_agent: handed to ${target.name} (${target.jobTitle}). Reason: ${parsed.data.reason}`,
    },
  });

  publishAdminEvent({
    type: "conversation.updated",
    conversationId: context.conversationId,
    agentId: target.id,
  });

  return {
    content:
      `Handed to ${target.name}, ${target.jobTitle}. Tell the client who is taking over and ` +
      "why, in one sentence, then stop - do not answer their question yourself. " +
      `${target.name} picks up from the client's next message and can see everything said so far.`,
    effect: {
      kind: "transfer",
      toAgentId: target.id,
      toAgentName: target.name,
      reason: parsed.data.reason,
    },
  };
}

const HANDLERS: Record<
  ToolId,
  (input: unknown, context: ToolContext) => Promise<ToolOutcome>
> = {
  search_company_context: searchCompanyContext,
  log_issue: logIssue,
  log_suggestion: logSuggestion,
  escalate_to_human: escalateToHuman,
  transfer_to_agent: transferToAgent,
};

export async function executeToolCall(
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
    return await HANDLERS[call.name](call.input, context);
  } catch (error) {
    return {
      content: `${call.name} failed: ${
        error instanceof Error ? error.message : "unexpected error"
      }. Tell the client you could not complete that action.`,
      isError: true,
    };
  }
}
