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
import { captureMessage } from "@/lib/monitoring";
import { notifyInBackground } from "@/lib/notify";
import { buildRunPrompt, kickoffMessage } from "./prompt";
import { validTimeZone } from "@/lib/local-time";

/** Which networks each social connection reaches, in the words an agent sets on a draft. */
const SOCIAL_CONNECTORS: [string, string[]][] = [
  ["linkedin", ["LinkedIn"]],
  ["meta", ["Facebook", "Instagram"]],
  ["x", ["X"]],
  ["threads", ["Threads"]],
];
import { answersFor, contextQuestionsFor, effectiveContext } from "./context";
import { spaceKind } from "@/lib/space";
import { missingGrounding } from "./preflight";
import { connectorChoice, connectorsForTool } from "@/lib/integrations/catalog";
import { summarizeRun } from "./summary";
import { postTaskResult } from "@/lib/team";
import { WORK_TOOL_IDS, scopeTools, workToolDefinitions } from "./tools";
import { executeWorkTool, executePendingAction, recordEscalation, type RunContext } from "./execute";
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
const MAX_WORK_ITERATIONS = 12;

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
      ...(to === "needs_approval" ? { awaitingSince: new Date(), completedAt: null } : {}),
      ...(["done", "failed", "rejected", "cancelled"].includes(to) ? { completedAt: new Date() } : {}),
    },
  });
}

interface LoadedRun {
  ctx: RunContext;
  systemPrompt: string;
  kickoff: string;
  /** Grounding the run needs and does not have. Non-empty means escalate, not run. */
  missing: string[];
}

/** Marks the item running and assembles everything the loop needs. Null if it is not runnable. */
async function loadRun(actionItemId: string): Promise<LoadedRun | null> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    include: {
      agent: {
        include: {
          scopeOfWork: true,
          documents: { where: { status: "ready" }, select: { id: true, filename: true } },
          // The project's shared context is inherited by every agent in it.
          project: { select: { context: true, contextAnswers: true, organization: { select: { kind: true } } } },
          rules: { select: { text: true }, orderBy: { createdAt: "asc" } },
        },
      },
      parent: { select: { result: true } },
    },
  });
  if (!item || item.status !== "queued") return null;

  const scope = item.agent.scopeOfWork;
  // Its schedule's zone is the owner's: set from their browser when it was hired.
  const timeZone = validTimeZone(scope?.timezone);
  const kind = spaceKind(item.agent.project.organization.kind);
  const questions = contextQuestionsFor(kind);
  const autonomy = (scope?.autonomy ?? "draft_only") as AutonomyMode;
  const documentIds = scope ? toStringArray(scope.documentIds) : [];
  const objectives = scope ? toStringArray(scope.objectives) : [];
  const tools = scopeTools(scope?.tools);
  const documents = item.agent.documents.filter(
    (d) => documentIds.length === 0 || documentIds.includes(d.id),
  );

  const [publishing, email, colleagues, connectedTypes] = await Promise.all([
    findIntegration(item.organizationId, "webhook"),
    resolveEmail(item.organizationId),
    prisma.agent.findMany({
      where: {
        status: "published",
        projectId: item.agent.projectId,
        id: { not: item.agent.id },
      },
      select: { id: true, name: true, jobTitle: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.integration.findMany({
      where: { organizationId: item.organizationId, enabled: true, secret: { not: null } },
      select: { type: true },
    }),
  ]);
  // The connectors this run's own tools need but nobody has connected yet, so the
  // agent hears it once up front instead of discovering it one refused call at a time.
  const connected = new Set(connectedTypes.map((row) => row.type));
  // A tool is covered when any connector that serves it is connected (Gmail or Outlook, say).
  const missingConnections = [
    ...new Set(
      (tools ?? [...WORK_TOOL_IDS])
        .map((tool) => connectorsForTool(tool).filter((connector) => connector.oauthProvider))
        .filter((choices) => choices.length > 0 && !choices.some((connector) => connected.has(connector.id)))
        .map(connectorChoice),
    ),
  ];

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
      // No documents means search_documents can only come back empty, and
      // no CSV means there is no statement to add up.
      tools: (tools ?? [...WORK_TOOL_IDS]).filter(
        (tool) =>
          (documents.length > 0 || tool !== "search_documents") &&
          (tool !== "review_spending" || documents.some((d) => d.filename.toLowerCase().endsWith(".csv"))),
      ),
      documentIds,
      trigger: item.trigger,
      timeZone,
    },
    systemPrompt: buildRunPrompt({
      agent: item.agent,
      scope: {
        context: effectiveContext({
          projectContext: item.agent.project.context,
          agentContext: scope?.context,
          kind,
        }),
        objectives,
      },
      kind,
      rules: item.agent.rules.map((rule) => rule.text),
      autonomy,
      documentNames: documents.map((d) => d.filename),
      hasPublishing: Boolean(publishing),
      socialNetworks: SOCIAL_CONNECTORS.flatMap(([type, names]) => (connected.has(type) ? names : [])),
      hasEmail: Boolean(email),
      missingConnections,
      colleagues,
      timeZone,
    }),
    missing: missingGrounding({
      projectAnswers: answersFor(
        item.agent.project.contextAnswers,
        item.agent.project.context,
        questions.core,
      ),
      agentAnswers: answersFor(scope?.contextAnswers, scope?.context, questions.agent),
      objectives,
      tools,
      documentCount: documents.length,
      trigger: item.trigger,
      kind,
    }),
    kickoff: kickoffMessage({
      trigger: item.trigger,
      payload: { ...payload, ...(parentSummary ? { parentSummary } : {}) },
      startedAt: new Date(),
      timeZone,
    }),
  };
}

async function finishRun(
  actionItemId: string,
  outcome: { summary: string; inputTokens: number; outputTokens: number; error?: string },
) {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: {
      status: true,
      result: true,
      pendingAction: true,
      organizationId: true,
      agentId: true,
      headline: true,
      agent: { select: { name: true, project: { select: { slug: true } } } },
    },
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
  // A failed run is something the agent is telling its owner about itself -
  // in the inbox, in the notification channel, and in error monitoring.
  const agent = item.agent;
  const path = `/p/${agent.project.slug}/work/${actionItemId}`;
  if (outcome.error) {
    captureMessage(`Action item failed: ${outcome.error}`, {
      organizationId: item.organizationId,
      agentId: item.agentId,
      actionItemId,
    });
    notifyInBackground({
      kind: "run_failed",
      title: "A scheduled task failed",
      body: outcome.error,
      agentName: agent.name,
      path,
      severity: "medium",
      organizationId: item.organizationId,
    });
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
  } else {
    // To the people who chose to hear about it (Alerts): never the operators' webhook.
    const summary = outcome.summary.trim().slice(0, 600);
    notifyInBackground({
      kind: to === "needs_approval" ? "approval_waiting" : "work_done",
      title: to === "needs_approval" ? "Needs your OK" : "Task done",
      body: item.headline ? `${item.headline}\n${summary}` : summary,
      agentName: agent.name,
      path,
      organizationId: item.organizationId,
      peopleOnly: true,
    });
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
  if (to === "done") await continueWorkflow(actionItemId);
  // A support ticket the agent could not settle: the helpdesk hears it needs a person.
  if (to !== "failed") {
    const flagged = await prisma.actionItem.findUnique({ where: { id: actionItemId }, select: { escalatedAt: true } });
    if (flagged?.escalatedAt) {
      const { reportToHelpdesk } = await import("./support-inbox");
      await reportToHelpdesk(actionItemId, "needs_human");
    }
  }
}

/** A finished workflow step starts the next one (workflow-run.ts). Never fails the run it follows. */
async function continueWorkflow(actionItemId: string) {
  try {
    const { advanceWorkflow } = await import("./workflow-run");
    await advanceWorkflow(actionItemId);
  } catch (error) {
    console.error("[work] workflow did not advance", error);
  }
}

/**
 * Runs one action item to completion, needs_approval, or failure.
 * Returns the final status, or null if the item was not runnable.
 */
/** False once the run has been cancelled (or removed) while it was working. */
async function stillRunning(actionItemId: string): Promise<boolean> {
  const row = await prisma.actionItem.findUnique({ where: { id: actionItemId }, select: { status: true } });
  return row?.status === "in_progress";
}

export async function runActionItem(
  actionItemId: string,
  step: StepRunner = inlineSteps,
): Promise<ActionStatus | null> {
  const loaded = await step("load", () => loadRun(actionItemId));
  if (!loaded) return null;
  const { ctx, systemPrompt, kickoff, missing } = loaded;

  if (missing.length > 0) {
    const summary =
      "I did not start this task: I am missing grounding I need to do it well.\n\n" +
      `Missing:\n${missing.map((m) => `- ${m}`).join("\n")}\n\n` +
      "Fill these in and run me again.";
    await step("preflight-escalate", () =>
      recordEscalation(
        ctx,
        "Needs more context before it can work",
        `Missing before the run could start: ${missing.join("; ")}.`,
      ),
    );
    await step("finish", () =>
      finishRun(actionItemId, { summary, inputTokens: 0, outputTokens: 0 }),
    );
    return "done";
  }

  const provider = await getProvider(ctx.agent.modelProvider);
  const tools = workToolDefinitions(ctx.tools);
  const messages: ChatMessage[] = [{ role: "user", content: kickoff }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let summary = "";
  let error: string | undefined;

  try {
    for (let i = 0; i < MAX_WORK_ITERATIONS; i++) {
      // An owner can cancel mid-run: stop before spending another model turn.
      if (i > 0 && !(await step(`still-running-${i}`, () => stillRunning(actionItemId)))) break;
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
      // ...and before any tool acts on the world.
      if (!(await step(`still-running-tools-${i}`, () => stillRunning(actionItemId)))) break;

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
  // The owner's account of the run, written after the work is on the record so
  // a crash here costs a summary, never the work itself. Its own step: a retry
  // resumes here instead of re-running the task.
  await step("summarize", async () => {
    const written = await summarizeRun(actionItemId).catch((caught: unknown) => {
      console.error("[work] summary not written", caught);
      return null;
    });
    return written?.headline ?? null;
  });
  // Asked for in the team room: the agent reports back there. Its own step, so a retry never posts twice.
  await step("report-to-team", () =>
    postTaskResult(actionItemId).catch((caught: unknown) => console.error("[work] team report not posted", caught)),
  );
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
  if (delivery.ok) await step("continue-workflow", () => continueWorkflow(actionItemId));
  // The reply to a support ticket went out: the helpdesk hears it was answered.
  if (delivery.ok && action.tool === "send_email") {
    await step("report-to-helpdesk", async () => {
      const { reportToHelpdesk } = await import("./support-inbox");
      await reportToHelpdesk(actionItemId, "answered");
    });
  }
  return delivery.ok ? "done" : "failed";
}

