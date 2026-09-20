/**
 * Executes one work-tool call inside a run.
 *
 * The risk gate lives here and nowhere else: an `external` tool in draft-only
 * mode never reaches its integration. It records what it would have done on
 * the action item as `pendingAction` and tells the model the task is now
 * waiting for a person.
 */
import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { retrieveContext } from "@/lib/rag/retriever";
import type { ToolCall } from "@/lib/llm/provider";
import { inngest } from "@/lib/jobs/client";
import { researchTheWeb, type ResearchFindings } from "./research";
import {
  deliverEmail,
  deliverWebhook,
  findIntegration,
  parseRecipients,
  resolveEmail,
  type DeliveryResult,
  type WebhookConfig,
} from "./integrations";
import { WORK_TOOL_RISK, isWorkToolId } from "./tools";
import { DRAFT_KINDS, type AutonomyMode, type PendingAction, type WorkStep } from "./types";

export interface RunContext {
  actionItemId: string;
  organizationId: string;
  agent: { id: string; name: string; modelProvider: string; model: string | null };
  autonomy: AutonomyMode;
  /** Empty means every ready document the agent has. */
  documentIds: string[];
}

export interface WorkToolOutcome {
  content: string;
  isError?: boolean;
  /** Set when an external tool was stopped for approval. */
  gate?: PendingAction;
}

const MAX_FOLLOWUP_DELAY_MINUTES = 30 * 24 * 60;

const searchSchema = z.object({ query: z.string().trim().min(1).max(500) });
const researchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  focus: z.string().trim().max(500).optional(),
});
const draftSchema = z.object({
  kind: z.enum(DRAFT_KINDS),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(60_000),
  platform: z.string().trim().max(60).optional(),
  to: z.string().trim().max(1000).optional(),
});
const publishSchema = z.object({
  draft_id: z.string().trim().min(1),
  note: z.string().trim().max(500).optional(),
});
const emailSchema = z
  .object({
    draft_id: z.string().trim().min(1).optional(),
    to: z.string().trim().max(1000).optional(),
    subject: z.string().trim().max(300).optional(),
    body: z.string().trim().max(60_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.draft_id || (v.to && v.subject && v.body), {
    message: "Provide draft_id, or to + subject + body.",
  });
const followupSchema = z.object({
  objective: z.string().trim().min(1).max(2000),
  delay_minutes: z.number().int().min(0).max(MAX_FOLLOWUP_DELAY_MINUTES).optional(),
});

function invalid(tool: string, error: z.ZodError): WorkToolOutcome {
  const issues = error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
  return { content: `${tool} was called with invalid input (${issues}).`, isError: true };
}

/** Long strings trimmed so a step record stays readable and small. */
function trimInput(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 300 ? `${value.slice(0, 300)}…` : value,
    ]),
  );
}

async function mergeResult(actionItemId: string, patch: (current: Record<string, unknown>) => Record<string, unknown>) {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { result: true },
  });
  const current = (item.result as Record<string, unknown> | null) ?? {};
  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { result: patch(current) as Prisma.InputJsonValue },
  });
}

async function appendStep(actionItemId: string, step: WorkStep) {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    select: { steps: true },
  });
  const steps = ((item.steps as WorkStep[] | null) ?? []).concat(step);
  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { steps: steps as unknown as Prisma.InputJsonValue },
  });
}

// --- tools ------------------------------------------------------------------

async function searchContext(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return invalid("search_context", parsed.error);
  const hits = (await retrieveContext(ctx.agent.id, parsed.data.query, 6)).filter(
    (hit) => ctx.documentIds.length === 0 || ctx.documentIds.includes(hit.documentId),
  );
  if (hits.length === 0) {
    return { content: "No relevant passages in the context documents for that query." };
  }
  return {
    content: hits
      .map((hit, i) => `[${i + 1}] ${hit.filename} (chunk ${hit.chunkIndex + 1})\n${hit.content}`)
      .join("\n\n---\n\n"),
  };
}

async function webResearch(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = researchSchema.safeParse(input);
  if (!parsed.success) return invalid("web_research", parsed.error);
  const findings = await researchTheWeb({
    ...parsed.data,
    billing: { organizationId: ctx.organizationId, agentId: ctx.agent.id },
    modelProvider: ctx.agent.modelProvider,
    model: ctx.agent.model,
  });
  await mergeResult(ctx.actionItemId, (current) => ({
    ...current,
    findings: [...((current.findings as ResearchFindings[] | undefined) ?? []), findings],
  }));
  const sources = findings.sources.map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`).join("\n");
  return {
    content: `${findings.findings}\n\nSources:\n${sources || "(none)"}\n\n(Saved to this task's results.)`,
  };
}

async function draftContent(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return invalid("draft_content", parsed.error);
  const { kind, title, body, platform, to } = parsed.data;
  const draft = await prisma.draft.create({
    data: {
      organizationId: ctx.organizationId,
      agentId: ctx.agent.id,
      actionItemId: ctx.actionItemId,
      kind,
      title,
      body,
      metadata: {
        ...(platform ? { platform } : {}),
        ...(to ? { to } : {}),
        ...(kind === "email" ? { subject: title } : {}),
      },
    },
    select: { id: true },
  });
  await mergeResult(ctx.actionItemId, (current) => ({
    ...current,
    draftIds: [...((current.draftIds as string[] | undefined) ?? []), draft.id],
  }));
  return { content: `Draft saved: id ${draft.id} (${kind}, "${title}"). It has not been published or sent.` };
}

/** Both external tools share the gate; the only difference is what they deliver. */
async function gateOrDeliver(
  ctx: RunContext,
  action: PendingAction,
): Promise<WorkToolOutcome> {
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id: ctx.actionItemId },
    select: { pendingAction: true },
  });
  if (item.pendingAction) {
    return {
      content:
        "This task already has an action waiting for approval. One external action per task: finish your report now and schedule a follow-up for anything else.",
      isError: true,
    };
  }

  if (ctx.autonomy === "draft_only") {
    await prisma.actionItem.update({
      where: { id: ctx.actionItemId },
      data: { pendingAction: action as unknown as Prisma.InputJsonValue },
    });
    return {
      content:
        `${action.tool} is queued for human approval and nothing has gone out. ` +
        "Do not call it again. Finish now with your report; the task resumes once a person approves or rejects it.",
      gate: action,
    };
  }

  const delivery = await executePendingAction(ctx.actionItemId, ctx.organizationId, action);
  return delivery.ok
    ? { content: `${action.tool} completed: ${delivery.detail}` }
    : { content: `${action.tool} failed: ${delivery.detail}`, isError: true };
}

async function publishPost(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return invalid("publish_post", parsed.error);
  const webhook = await findIntegration<WebhookConfig>(ctx.organizationId, "webhook");
  if (!webhook) {
    return {
      content:
        "No publishing integration is connected for this organisation, so nothing can be published. Leave the draft and note it in your report.",
      isError: true,
    };
  }
  const draft = await prisma.draft.findFirst({
    where: { id: parsed.data.draft_id, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  });
  if (!draft) return { content: `No draft with id ${parsed.data.draft_id}.`, isError: true };
  if (draft.status !== "draft") return { content: "That draft has already gone out.", isError: true };
  return gateOrDeliver(ctx, {
    tool: "publish_post",
    input: { draft_id: draft.id },
    draftId: draft.id,
    note: parsed.data.note,
  });
}

async function sendEmail(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return invalid("send_email", parsed.error);
  const email = await resolveEmail(ctx.organizationId);
  if (!email) {
    return {
      content:
        "No email provider is connected for this organisation, so nothing can be sent. Leave the draft and note it in your report.",
      isError: true,
    };
  }

  let draftId = parsed.data.draft_id;
  let message = { to: parsed.data.to ?? "", subject: parsed.data.subject ?? "", body: parsed.data.body ?? "" };
  if (draftId) {
    const draft = await prisma.draft.findFirst({
      where: { id: draftId, organizationId: ctx.organizationId },
    });
    if (!draft) return { content: `No draft with id ${draftId}.`, isError: true };
    if (draft.status !== "draft") return { content: "That draft has already been sent.", isError: true };
    const meta = (draft.metadata as { to?: string; subject?: string } | null) ?? {};
    message = {
      to: parsed.data.to ?? meta.to ?? "",
      subject: parsed.data.subject ?? meta.subject ?? draft.title,
      body: draft.body,
    };
  } else {
    // A direct send is still saved as a draft so the approver sees the exact text.
    const draft = await prisma.draft.create({
      data: {
        organizationId: ctx.organizationId,
        agentId: ctx.agent.id,
        actionItemId: ctx.actionItemId,
        kind: "email",
        title: message.subject,
        body: message.body,
        metadata: { to: message.to, subject: message.subject },
      },
      select: { id: true },
    });
    draftId = draft.id;
  }

  const recipients = parseRecipients(message.to);
  if (recipients.length === 0) {
    return { content: "send_email needs at least one valid recipient address.", isError: true };
  }
  return gateOrDeliver(ctx, {
    tool: "send_email",
    input: { draft_id: draftId, to: recipients, subject: message.subject },
    draftId,
    note: parsed.data.note,
  });
}

async function scheduleFollowup(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = followupSchema.safeParse(input);
  if (!parsed.success) return invalid("schedule_followup", parsed.error);
  const delay = parsed.data.delay_minutes ?? 0;
  const scheduledFor = delay > 0 ? new Date(Date.now() + delay * 60_000) : null;

  const followup = await prisma.actionItem.create({
    data: {
      organizationId: ctx.organizationId,
      agentId: ctx.agent.id,
      type: "followup",
      trigger: "followup",
      parentId: ctx.actionItemId,
      scheduledFor,
      payload: { objective: parsed.data.objective, parentId: ctx.actionItemId },
    },
    select: { id: true },
  });
  await mergeResult(ctx.actionItemId, (current) => ({
    ...current,
    followupIds: [...((current.followupIds as string[] | undefined) ?? []), followup.id],
  }));
  await inngest.send({
    name: "work/action-item.run",
    data: { actionItemId: followup.id },
  });
  return {
    content: `Follow-up queued as task ${followup.id}, ${
      scheduledFor ? `starting ${scheduledFor.toISOString()}` : "starting as soon as this task finishes"
    }.`,
  };
}

// --- dispatch ---------------------------------------------------------------

export async function executeWorkTool(call: ToolCall, ctx: RunContext): Promise<WorkToolOutcome> {
  let outcome: WorkToolOutcome;
  if (!isWorkToolId(call.name)) {
    outcome = { content: `Unknown tool "${call.name}".`, isError: true };
  } else {
    try {
      switch (call.name) {
        case "search_context":
          outcome = await searchContext(call.input, ctx);
          break;
        case "web_research":
          outcome = await webResearch(call.input, ctx);
          break;
        case "draft_content":
          outcome = await draftContent(call.input, ctx);
          break;
        case "publish_post":
          outcome = await publishPost(call.input, ctx);
          break;
        case "send_email":
          outcome = await sendEmail(call.input, ctx);
          break;
        case "schedule_followup":
          outcome = await scheduleFollowup(call.input, ctx);
          break;
      }
    } catch (error) {
      outcome = {
        content: `${call.name} failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isError: true,
      };
    }
  }

  const step: WorkStep = {
    at: new Date().toISOString(),
    tool: call.name,
    input: trimInput(call.input),
    output: outcome.content.slice(0, 600),
    ok: !outcome.isError,
  };
  await appendStep(ctx.actionItemId, step);
  await audit({
    organizationId: ctx.organizationId,
    actorType: "agent",
    actorId: ctx.agent.id,
    action: "tool.called",
    targetType: "action_item",
    targetId: ctx.actionItemId,
    metadata: {
      tool: call.name,
      risk: isWorkToolId(call.name) ? WORK_TOOL_RISK[call.name] : "unknown",
      ok: step.ok,
      gated: Boolean(outcome.gate),
      input: step.input as Prisma.InputJsonValue,
    },
  });
  return outcome;
}

/**
 * Sends what an approval released - or what auto mode allows straight
 * through. The draft is marked as gone the moment delivery succeeds.
 */
export async function executePendingAction(
  actionItemId: string,
  organizationId: string,
  action: PendingAction,
): Promise<DeliveryResult> {
  const draft = action.draftId
    ? await prisma.draft.findFirst({ where: { id: action.draftId, organizationId } })
    : null;

  let delivery: DeliveryResult;
  if (action.tool === "publish_post") {
    const webhook = await findIntegration<WebhookConfig>(organizationId, "webhook");
    if (!webhook) return { ok: false, status: 0, detail: "No publishing integration is connected." };
    if (!draft) return { ok: false, status: 0, detail: "The draft no longer exists." };
    const item = await prisma.actionItem.findUnique({
      where: { id: actionItemId },
      select: { agent: { select: { name: true, jobTitle: true } } },
    });
    delivery = await deliverWebhook(webhook.config, {
      event: "publish_post",
      actionItemId,
      agent: item?.agent ?? null,
      note: action.note ?? null,
      draft: {
        id: draft.id,
        kind: draft.kind,
        title: draft.title,
        body: draft.body,
        metadata: draft.metadata,
      },
    });
  } else {
    const email = await resolveEmail(organizationId);
    if (!email) return { ok: false, status: 0, detail: "No email provider is connected." };
    const to = Array.isArray(action.input.to) ? (action.input.to as string[]) : [];
    const subject = String(action.input.subject ?? draft?.title ?? "");
    const body = draft?.body ?? "";
    if (to.length === 0 || !subject || !body) {
      return { ok: false, status: 0, detail: "The email is missing a recipient, subject or body." };
    }
    delivery = await deliverEmail(email, { to, subject, text: body });
  }

  if (delivery.ok && draft) {
    await prisma.draft.update({
      where: { id: draft.id },
      data: {
        status: action.tool === "publish_post" ? "published" : "sent",
        publishedAt: new Date(),
      },
    });
  }
  await mergeResult(actionItemId, (current) => ({ ...current, external: delivery }));
  return delivery;
}
