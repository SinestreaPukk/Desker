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
import { prisma } from "@/lib/platform/db";
import { audit } from "@/lib/platform/audit";
import type { ToolCall } from "@/lib/llm/provider";
import { searchDocuments } from "@/lib/rag/search-documents";
import { SEARCH_DOCUMENTS, searchDocumentsInput } from "@/lib/rag/search-documents-tool";
import { saveMemory, forgetMemory, recallMemories } from "@/lib/memory/store";
import type { MemoryKind } from "@/lib/memory/types";
import {
  createCommitment,
  updateCommitment,
  listCommitments,
  closeCommitment,
} from "@/lib/commitments/store";
import type { CommitmentType, CommitmentStatus, CommitmentOwnerRole } from "@/lib/commitments/types";
import { processIntake } from "@/lib/capture/pipeline";
import { listTriggerRules, updateTriggerRule } from "@/lib/triggers/engine";
import { isToolId } from "./registry";

export interface ToolContext {
  /** The agent currently answering - the one whose tools these are. */
  agentId: string;
  projectId?: string;
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

async function getProjectId(context: ToolContext): Promise<string> {
  if (context.projectId) return context.projectId;
  const agent = await prisma.agent.findUnique({
    where: { id: context.agentId },
    select: { projectId: true },
  });
  if (!agent) throw new Error("Agent project not found.");
  return agent.projectId;
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
    switch (call.name) {
      case "search_documents":
        return await searchDocumentsTool(call.input, context);

      case "remember": {
        const projectId = await getProjectId(context);
        const fact = String(call.input.fact ?? "").trim();
        const kind = call.input.kind as MemoryKind | undefined;
        const personName = call.input.personName as string | undefined;
        const inferred = Boolean(call.input.inferred);
        const res = await saveMemory({ projectId, fact, kind, personName, inferred });
        return { content: res.message };
      }

      case "forget": {
        const projectId = await getProjectId(context);
        const query = call.input.query as string | undefined;
        const memoryId = call.input.memoryId as string | undefined;
        const res = await forgetMemory({ projectId, query, id: memoryId });
        return { content: res.message };
      }

      case "recall": {
        const projectId = await getProjectId(context);
        const query = String(call.input.query ?? "").trim();
        const kind = call.input.kind as string | undefined;
        const personName = call.input.personName as string | undefined;
        const memories = await recallMemories({ projectId, query, kind, personName });
        if (memories.length === 0) return { content: "No relevant memories found." };
        const lines = memories.map((m) => `- ${m.fact}${m.personName ? ` (about ${m.personName})` : ""}`);
        return { content: `Recalled memories:\n${lines.join("\n")}` };
      }

      case "create_commitment": {
        const projectId = await getProjectId(context);
        const outcome = String(call.input.outcome ?? "").trim();
        const type = (call.input.type as CommitmentType) || "to_do";
        const dueAt = call.input.dueAt as string | undefined;
        const ownerRole = call.input.ownerRole as CommitmentOwnerRole | undefined;
        const ownerName = call.input.ownerName as string | undefined;
        const sourceRef = call.input.sourceRef as string | undefined;
        const c = await createCommitment({ projectId, type, outcome, dueAt, ownerRole, ownerName, sourceRef });
        return { content: `Commitment created: "${c.outcome}" (status: ${c.status}${c.dueAt ? `, due: ${c.dueAt}` : ""}).` };
      }

      case "update_commitment": {
        const projectId = await getProjectId(context);
        const id = String(call.input.id ?? "");
        const outcome = call.input.outcome as string | undefined;
        const dueAt = call.input.dueAt as string | undefined;
        const status = call.input.status as CommitmentStatus | undefined;
        const snoozedUntil = call.input.snoozedUntil as string | undefined;
        const note = call.input.note as string | undefined;
        const c = await updateCommitment({ id, projectId, outcome, dueAt, status, snoozedUntil, note });
        return { content: `Commitment updated: "${c.outcome}" (status: ${c.status}).` };
      }

      case "list_commitments": {
        const projectId = await getProjectId(context);
        const status = call.input.status as string | undefined;
        const type = call.input.type as CommitmentType | undefined;
        const ownerName = call.input.ownerName as string | undefined;
        const list = await listCommitments(projectId, { status, type, ownerName });
        if (list.length === 0) return { content: "No commitments match." };
        const lines = list.map((c) => `- [${c.type}] ${c.outcome} (${c.status}${c.ownerName ? `, waiting on: ${c.ownerName}` : ""}${c.dueAt ? `, due: ${c.dueAt}` : ""})`);
        return { content: `Commitments:\n${lines.join("\n")}` };
      }

      case "close_commitment": {
        const projectId = await getProjectId(context);
        const id = String(call.input.id ?? "");
        const status = (call.input.status as "done" | "dropped") || "done";
        const reason = call.input.reason as string | undefined;
        const c = await closeCommitment(id, projectId, status, reason);
        return { content: `Commitment closed as ${status}: "${c.outcome}".` };
      }

      case "capture_item": {
        const projectId = await getProjectId(context);
        const content = String(call.input.content ?? "");
        const res = await processIntake({
          projectId,
          organizationId: context.organizationId || "",
          inputType: "text",
          text: content,
        });
        return { content: res.confirmationText };
      }

      case "update_trigger_rule": {
        const projectId = await getProjectId(context);
        const ruleName = String(call.input.ruleName ?? "");
        const enabled = typeof call.input.enabled === "boolean" ? call.input.enabled : undefined;
        const time = call.input.time as string | undefined;
        const quietHoursStart = call.input.quietHoursStart as string | undefined;
        const quietHoursEnd = call.input.quietHoursEnd as string | undefined;
        const description = call.input.description as string | undefined;
        const updated = await updateTriggerRule(projectId, { ruleName, enabled, time, quietHoursStart, quietHoursEnd, description });
        return { content: `Rule "${updated.name}" updated: ${updated.enabled ? "enabled" : "disabled"}${updated.config.time ? ` at ${updated.config.time}` : ""}.` };
      }

      case "list_trigger_rules": {
        const projectId = await getProjectId(context);
        const rules = await listTriggerRules(projectId);
        const lines = rules.map((r) => `- ${r.name} (${r.enabled ? "on" : "off"}): ${r.description}${r.config.time ? ` [time: ${r.config.time}]` : ""}`);
        return { content: `Proactive trigger rules:\n${lines.join("\n")}` };
      }

      default:
        return { content: `Unhandled tool "${call.name}".`, isError: true };
    }
  } catch (error) {
    return {
      content: `${call.name} failed: ${
        error instanceof Error ? error.message : "unexpected error"
      }. Tell the user you could not complete that action.`,
      isError: true,
    };
  }
}
