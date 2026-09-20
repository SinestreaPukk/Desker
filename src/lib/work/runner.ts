/**
 * The autonomous work loop.
 *
 * One action item, one run: load the agent's brief, hand the model the tool
 * set, and alternate model turns with tool calls until the model stops
 * calling tools or the iteration cap is hit. Every model turn and every tool
 * call is wrapped in a `StepRunner` so the Inngest function that hosts it can
 * make each one a durable step - a retry after a crash resumes from the last
 * completed step instead of re-running (and re-billing) the whole thing.
 *
 * Nothing here knows about Inngest. Tests pass an identity StepRunner.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  ModelError,
  getProvider,
  type ChatMessage,
  type CompleteResult,
} from "@/lib/llm/provider";
import { toStringArray } from "@/lib/agent-fields";
import { findIntegration, resolveEmail } from "./integrations";
import { hasSearchProvider } from "./research";
import { buildRunPrompt, kickoffMessage } from "./prompt";
import { WORK_TOOL_IDS, workToolDefinitions } from "./tools";
import { executeWorkTool, executePendingAction, type RunContext } from "./execute";
import {
  canTransition,
  type ActionStatus,
  type AutonomyMode,
  type PendingAction,
  type ToolAutonomy,
} from "./types";

export type StepRunner = <T>(id: string, fn: () => Promise<T>) => Promise<T>;

/** For tests and synchronous callers: no durability, just run it. */
export const inlineSteps: StepRunner = (_id, fn) => fn();

/** Guard against a model that never stops calling tools. */
export const MAX_WORK_ITERATIONS = 12;

export class InvalidTransition extends Error {
  constructor(from: string, to: ActionStatus) {
    super(`An action item cannot move from ${from} to ${to}.`);
    this.name = "InvalidTransition";
  }
}

/** The one place statuses change. Throws rather than allowing a bad move. */
export async function transition(
  actionItemId: string,
  to: ActionStatus,
  data: Prisma.ActionItemUpdateInput = {},
) {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { status: true },
  });
  if (!canTransition(item.status, to)) throw new InvalidTransition(item.status, to);
  return prisma.actionItem.update({
    where: { id: actionItemId },
    data: {
      ...data,
      status: to,
      ...(to === "in_progress" ? { startedAt: new Date() } : {}),
      ...(to === "needs_approval" ? { awaitingSince: new Date() } : {}),
      ...(["done", "failed", "rejected"].includes(to) ? { completedAt: new Date() } : {}),
    },
  });
}

interface LoadedRun {
  ctx: RunContext;
  systemPrompt: string;
  kickoff: string;
}

/** Marks the item running and assembles everything the loop needs. Null if it is not runnable. */
async function loadRun(actionItemId: string): Promise<LoadedRun | null> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    include: {
      agent: { include: { scopeOfWork: true, documents: { where: { status: "ready" }, select: { id: true, filename: true } } } },
      parent: { select: { result: true } },
    },
  });
  if (!item || item.status !== "queued") return null;

  const scope = item.agent.scopeOfWork;
  const autonomy = (scope?.autonomy ?? "draft_only") as AutonomyMode;
  const documentIds = scope ? toStringArray(scope.documentIds) : [];
  const documents = item.agent.documents.filter(
    (d) => documentIds.length === 0 || documentIds.includes(d.id),
  );

  const [publishing, email] = await Promise.all([
    findIntegration(item.organizationId, "webhook"),
    resolveEmail(item.organizationId),
  ]);

  await transition(actionItemId, "in_progress");

  const payload = (item.payload as Record<string, unknown>) ?? {};
  const parentSummary = (item.parent?.result as { summary?: string } | null)?.summary;

  return {
    ctx: {
      actionItemId,
      organizationId: item.organizationId,
      agent: {
        id: item.agent.id,
        name: item.agent.name,
        modelProvider: item.agent.modelProvider,
        model: item.agent.model,
      },
      autonomy,
      toolAutonomy: (scope?.toolAutonomy as ToolAutonomy | null) ?? null,
      documentIds,
      trigger: item.trigger,
    },
    systemPrompt: buildRunPrompt({
      agent: item.agent,
      scope: {
        context: scope?.context ?? "",
        objectives: scope ? toStringArray(scope.objectives) : [],
      },
      autonomy,
      documentNames: documents.map((d) => d.filename),
      hasPublishing: Boolean(publishing),
      hasEmail: Boolean(email),
      hasSearch: hasSearchProvider(),
    }),
    kickoff: kickoffMessage({
      trigger: item.trigger,
      payload: { ...payload, ...(parentSummary ? { parentSummary } : {}) },
      startedAt: new Date(),
    }),
  };
}

async function finishRun(
  actionItemId: string,
  outcome: { summary: string; inputTokens: number; outputTokens: number; error?: string },
) {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { status: true, result: true, pendingAction: true, organizationId: true, agentId: true },
  });
  if (item.status !== "in_progress") return; // finished by a retry that already got here
  const result = { ...((item.result as Record<string, unknown> | null) ?? {}), summary: outcome.summary };
  const to: ActionStatus = outcome.error ? "failed" : item.pendingAction ? "needs_approval" : "done";
  await transition(actionItemId, to, {
    result: result as Prisma.InputJsonValue,
    inputTokens: { increment: outcome.inputTokens },
    outputTokens: { increment: outcome.outputTokens },
    ...(outcome.error ? { error: outcome.error } : {}),
  });
  // A failed run is something the agent is telling its owner about itself.
  if (outcome.error) {
    await prisma.issue
      .create({
        data: {
          agentId: item.agentId,
          actionItemId,
          source: "agent",
          type: "failure",
          severity: "medium",
          summary: "A task failed before it could finish",
          details: outcome.error,
        },
      })
      .catch((error: unknown) => console.error("[work] failure issue not recorded", error));
  }
  await audit({
    organizationId: item.organizationId,
    actorType: "agent",
    actorId: item.agentId,
    action: `action_item.${to}`,
    targetType: "action_item",
    targetId: actionItemId,
    metadata: outcome.error ? { error: outcome.error } : { summary: outcome.summary.slice(0, 300) },
  });
}

/**
 * Runs one action item to completion, needs_approval, or failure.
 * Returns the final status, or null if the item was not runnable.
 */
export async function runActionItem(
  actionItemId: string,
  step: StepRunner = inlineSteps,
): Promise<ActionStatus | null> {
  const loaded = await step("load", () => loadRun(actionItemId));
  if (!loaded) return null;
  const { ctx, systemPrompt, kickoff } = loaded;

  const provider = await getProvider(ctx.agent.modelProvider);
  const tools = workToolDefinitions(WORK_TOOL_IDS);
  const messages: ChatMessage[] = [{ role: "user", content: kickoff }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let summary = "";
  let error: string | undefined;

  try {
    for (let i = 0; i < MAX_WORK_ITERATIONS; i++) {
      const turn: CompleteResult = await step(`turn-${i}`, () =>
        provider.complete({
          billing: { organizationId: ctx.organizationId, agentId: ctx.agent.id },
          systemPrompt,
          messages,
          tools,
          model: ctx.agent.model,
          maxTokens: 4096,
        }),
      );
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
      messages.push(turn.message);

      const calls = turn.message.toolCalls ?? [];
      if (calls.length === 0) {
        summary = turn.message.content.trim();
        break;
      }
      if (turn.message.content.trim()) summary = turn.message.content.trim();

      const results = [];
      for (const [j, call] of calls.entries()) {
        const outcome = await step(`tool-${i}-${j}`, () => executeWorkTool(call, ctx));
        results.push({
          id: call.id,
          name: call.name,
          content: outcome.content,
          ...(outcome.isError ? { isError: true } : {}),
        });
      }
      messages.push({ role: "tool", results });

      if (i === MAX_WORK_ITERATIONS - 1) {
        summary = `${summary}\n\n(Stopped after ${MAX_WORK_ITERATIONS} rounds of tool calls without finishing.)`.trim();
      }
    }
  } catch (caught) {
    error =
      caught instanceof ModelError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "The run failed for an unknown reason.";
  }

  await step("finish", () => finishRun(actionItemId, { summary, ...usage, error }));
  const final = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: { status: true },
  });
  return (final?.status as ActionStatus) ?? null;
}

/** Approval released the pending external action: send it and close the item. */
export async function executeApprovedAction(
  actionItemId: string,
  step: StepRunner = inlineSteps,
): Promise<ActionStatus | null> {
  const item = await step("load-approved", async () => {
    const row = await prisma.actionItem.findUnique({
      where: { id: actionItemId },
      select: { status: true, organizationId: true, agentId: true, pendingAction: true },
    });
    if (!row || row.status !== "approved" || !row.pendingAction) return null;
    await transition(actionItemId, "executing_external");
    return row;
  });
  if (!item) return null;

  const action = item.pendingAction as unknown as PendingAction;
  const delivery = await step("deliver", () =>
    executePendingAction(actionItemId, item.organizationId, action),
  );

  await step("close", async () => {
    await transition(actionItemId, delivery.ok ? "done" : "failed", {
      ...(delivery.ok ? {} : { error: delivery.detail }),
    });
    await audit({
      organizationId: item.organizationId,
      actorType: "agent",
      actorId: item.agentId,
      action: delivery.ok ? `${action.tool}.delivered` : `${action.tool}.failed`,
      targetType: "action_item",
      targetId: actionItemId,
      metadata: { tool: action.tool, status: delivery.status, detail: delivery.detail },
    });
  });
  return delivery.ok ? "done" : "failed";
}
