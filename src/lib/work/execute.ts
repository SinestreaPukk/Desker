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
import { searchDocuments } from "@/lib/rag/search-documents";
import { searchDocumentsInput } from "@/lib/rag/search-documents-tool";
import type { ToolCall } from "@/lib/llm/provider";
import { inngest } from "@/lib/jobs/client";
import { afterResponse } from "@/lib/after-response";
import { notifyInBackground } from "@/lib/notify";
import { canStartRun } from "@/lib/billing/limits";
import { connectorAccess } from "@/lib/integrations/oauth";
import {
  createCalendarEvent,
  listCalendarEvents,
  postSlackMessage,
  readGithub,
} from "@/lib/integrations/providers";
import { researchTheWeb, type ResearchFindings } from "./research";
import {
  deliverEmail,
  deliverWebhook,
  findPublishing,
  parseRecipients,
  resolveEmail,
  type DeliveryResult,
} from "./integrations";
import { WORK_TOOL_RISK, isWorkToolId, type WorkToolId } from "./tools";
import {
  DRAFT_KINDS,
  effectiveAutonomy,
  type AutonomyMode,
  type PendingAction,
  type ToolAutonomy,
  type WorkStep,
} from "./types";

export interface RunContext {
  actionItemId: string;
  organizationId: string;
  agent: { id: string; name: string; modelProvider: string; model: string | null };
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy | null;
  /** The tools this run may call; the role template sets the default. */
  tools: readonly WorkToolId[];
  /** Empty means every ready document the agent has. */
  documentIds: string[];
  /** schedule | webhook | manual | followup - recorded on every audit row. */
  trigger: string;
}

interface WorkToolOutcome {
  content: string;
  isError?: boolean;
  /** Set when an external tool was stopped for approval. */
  gate?: PendingAction;
}

const MAX_FOLLOWUP_DELAY_MINUTES = 30 * 24 * 60;

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
const escalateSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  summary: z.string().trim().min(1).max(120),
});
const delegateSchema = z.object({
  colleague_id: z.string().trim().min(1),
  task: z.string().trim().min(1).max(3000),
  context_findings: z.string().trim().max(10_000).optional(),
});
const suggestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["opportunity", "news", "bug", "suggestion"]),
  what_happened: z.string().trim().min(1).max(5000),
  why_it_matters: z.string().trim().min(1).max(5000),
  recommended_action: z.string().trim().min(1).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

const isoTime = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "an ISO 8601 date-time");
const calendarListSchema = z.object({ from: isoTime, to: isoTime });
const calendarCreateSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  start: isoTime,
  end: isoTime,
  attendees: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(8000).optional(),
  note: z.string().trim().max(500).optional(),
});
const slackSchema = z.object({
  channel: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(8000),
  note: z.string().trim().max(500).optional(),
});
const githubSchema = z.object({
  action: z.enum(["list_repos", "list_issues", "get_issue", "read_file", "search_code"]),
  repo: z.string().trim().max(200).optional(),
  number: z.number().int().positive().optional(),
  path: z.string().trim().max(500).optional(),
  query: z.string().trim().max(300).optional(),
});

/**
 * The same answer for every missing connection: say what is missing, and tell
 * the agent to carry on and report it - the way publishing already degrades.
 */
function notConnected(what: string): WorkToolOutcome {
  return {
    content:
      `${what} is not connected for this organisation, so this cannot be done. ` +
      "Do what you can without it and say plainly in your report that connecting it under Integrations would let you finish.",
    isError: true,
  };
}

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

async function searchDocumentsTool(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = searchDocumentsInput.safeParse(input);
  if (!parsed.success) return invalid("search_documents", parsed.error);
  const { content } = await searchDocuments({
    agentId: ctx.agent.id,
    query: parsed.data.query,
    documentIds: ctx.documentIds,
    topK: 6,
  });
  return { content };
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

  if (effectiveAutonomy(ctx.autonomy, ctx.toolAutonomy, action.tool) === "draft_only") {
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
  const webhook = await findPublishing(ctx.organizationId);
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
  try {
    await inngest.send({
      name: "work/action-item.run",
      data: { actionItemId: followup.id, organizationId: ctx.organizationId },
    });
  } catch (error) {
    console.warn("[scheduleFollowup] inngest.send failed, running followup via afterResponse:", error);
    afterResponse(async () => {
      try {
        const { runActionItem, inlineSteps } = await import("./runner");
        await runActionItem(followup.id, inlineSteps);
      } catch (err) {
        console.error(`[scheduleFollowup:afterResponse] execution failed for followup ${followup.id}:`, err);
      }
    });
  }
  return {
    content: `Follow-up queued as task ${followup.id}, ${
      scheduledFor ? `starting ${scheduledFor.toISOString()}` : "starting as soon as this task finishes"
    }.`,
  };
}

/**
 * The agent asks for a person. The run keeps going - the point is the flag,
 * not a halt - and the item is marked so the inbox and the report agree.
 */
/** Puts an escalation on the record: an Issue for the inbox, and the flag on the task. */
export async function recordEscalation(ctx: RunContext, summary: string, reason: string) {
  await prisma.$transaction([
    prisma.issue.create({
      data: {
        agentId: ctx.agent.id,
        actionItemId: ctx.actionItemId,
        source: "agent",
        type: "escalation",
        severity: "high",
        summary,
        details: reason,
      },
    }),
    prisma.actionItem.update({
      where: { id: ctx.actionItemId },
      data: { escalatedAt: new Date(), escalationReason: reason },
    }),
  ]);
}

async function escalateToHuman(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = escalateSchema.safeParse(input);
  if (!parsed.success) return invalid("escalate_to_human", parsed.error);
  const existing = await prisma.actionItem.findUniqueOrThrow({
    where: { id: ctx.actionItemId },
    select: { escalatedAt: true },
  });
  if (existing.escalatedAt) {
    return { content: "This task is already escalated. Finish your report; a person will review it." };
  }
  await recordEscalation(ctx, parsed.data.summary, parsed.data.reason);
  return {
    content:
      "Escalated: a person will see this in their inbox. Finish what you safely can and put what they need to decide in your report.",
  };
}

/** How many times one task may be handed on: A -> B -> C, and C finishes it. */
const MAX_HANDOFFS = 2;

async function delegateToColleague(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = delegateSchema.safeParse(input);
  if (!parsed.success) return invalid("delegate_to_colleague", parsed.error);

  const { colleague_id, task, context_findings } = parsed.data;

  // The same roster the prompt offers: published agents in this project.
  const self = await prisma.agent.findUniqueOrThrow({
    where: { id: ctx.agent.id },
    select: { projectId: true },
  });
  const colleague = await prisma.agent.findFirst({
    where: { id: colleague_id, projectId: self.projectId, status: "published" },
    select: { id: true, name: true, jobTitle: true },
  });

  if (!colleague || colleague.id === ctx.agent.id) {
    return {
      content: `No colleague found with id "${colleague_id}" in this project. Check your team roster for valid ids.`,
      isError: true,
    };
  }

  // Walk back up the chain of hand-offs that led here. Two agents passing a
  // task back and forth - or an endless relay - would run up a bill with
  // nobody watching, so both are refused.
  const upstream = new Set<string>();
  let handoffs = 0;
  let cursor: string | null = ctx.actionItemId;
  while (cursor) {
    const row: { agentId: string; type: string; parentId: string | null } | null =
      await prisma.actionItem.findUnique({
        where: { id: cursor },
        select: { agentId: true, type: true, parentId: true },
      });
    if (!row) break;
    upstream.add(row.agentId);
    if (row.type === "colleague_delegation") handoffs++;
    cursor = row.parentId;
  }
  if (upstream.has(colleague.id)) {
    return {
      content: `${colleague.name} is already part of this chain of work - the task came to you through them. Finish it yourself, or escalate if you cannot.`,
      isError: true,
    };
  }
  if (handoffs >= MAX_HANDOFFS) {
    return {
      content: `This task has already been handed on ${handoffs} times. Finish it yourself, or escalate if you cannot.`,
      isError: true,
    };
  }

  // A hand-off is a run like any other, so it counts against the plan.
  const allowed = await canStartRun(ctx.organizationId);
  if (!allowed.allowed) {
    return { content: `Could not hand this on: ${allowed.reason}`, isError: true };
  }

  const delegatedItem = await prisma.actionItem.create({
    data: {
      organizationId: ctx.organizationId,
      agentId: colleague.id,
      type: "colleague_delegation",
      trigger: "delegation",
      parentId: ctx.actionItemId,
      payload: {
        objective: task,
        context: context_findings ?? "",
        delegatedByAgentId: ctx.agent.id,
        delegatedByAgentName: ctx.agent.name,
      },
    },
    select: { id: true },
  });

  await mergeResult(ctx.actionItemId, (current) => ({
    ...current,
    delegatedTaskIds: [...((current.delegatedTaskIds as string[] | undefined) ?? []), delegatedItem.id],
  }));

  try {
    await inngest.send({
      name: "work/action-item.run",
      data: { actionItemId: delegatedItem.id, organizationId: ctx.organizationId },
    });
  } catch (error) {
    console.warn("[delegateToColleague] inngest.send failed, running via afterResponse:", error);
    afterResponse(async () => {
      try {
        const { runActionItem, inlineSteps } = await import("./runner");
        await runActionItem(delegatedItem.id, inlineSteps);
      } catch (err) {
        console.error(`[delegateToColleague:afterResponse] execution failed for task ${delegatedItem.id}:`, err);
      }
    });
  }

  return {
    content: `Delegated task to ${colleague.name} (${colleague.jobTitle}) as task ${delegatedItem.id}. They will carry out the objective autonomously.`,
  };
}

async function suggestOpportunity(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return invalid("suggest_opportunity", parsed.error);

  const { title, type, what_happened, why_it_matters, recommended_action, severity } = parsed.data;

  const prefix =
    type === "opportunity"
      ? "Opportunity"
      : type === "news"
        ? "News Alert"
        : type === "bug"
          ? "Bug Report"
          : "Suggestion";
  const formattedSummary = `[${prefix}] ${title}`;
  const rationale = `What happened:\n${what_happened}\n\nWhy it matters:\n${why_it_matters}`;

  const [suggestion] = await prisma.$transaction([
    prisma.suggestion.create({
      data: {
        organizationId: ctx.organizationId,
        agentId: ctx.agent.id,
        actionItemId: ctx.actionItemId,
        summary: formattedSummary,
        rationale,
        proposal: recommended_action,
        status: "open",
      },
      select: { id: true },
    }),
    ...(type === "bug" || severity === "critical" || severity === "high"
      ? [
          prisma.issue.create({
            data: {
              agentId: ctx.agent.id,
              actionItemId: ctx.actionItemId,
              source: "agent",
              type: type === "bug" ? "issue" : "suggestion",
              severity: severity ?? "medium",
              summary: title,
              details: `${what_happened}\n\nImpact:\n${why_it_matters}\n\nRecommended Action:\n${recommended_action}`,
              status: "open",
            },
            select: { id: true },
          }),
        ]
      : []),
  ]);

  await mergeResult(ctx.actionItemId, (current) => ({
    ...current,
    suggestionIds: [...((current.suggestionIds as string[] | undefined) ?? []), suggestion.id],
  }));

  notifyInBackground({
    kind: "feedback",
    title: `${prefix}: ${title}`,
    body: `${what_happened}\n\nProposed action: ${recommended_action}`,
    agentName: ctx.agent.name,
    severity: severity ?? "medium",
  });

  return {
    content: `Logged ${type} to the team inbox as suggestion ${suggestion.id}${
      type === "bug" ? " and created a tracked bug issue" : ""
    }. The team has been notified.`,
  };
}

// --- dispatch ---------------------------------------------------------------

async function calendarListEvents(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = calendarListSchema.safeParse(input);
  if (!parsed.success) return invalid("calendar_list_events", parsed.error);
  const { from, to } = parsed.data;
  if (Date.parse(to) - Date.parse(from) > 31 * 86_400_000 || Date.parse(to) <= Date.parse(from)) {
    return { content: "The window must run forwards and be at most 31 days.", isError: true };
  }
  const access = await connectorAccess(ctx.organizationId, "google_calendar");
  if (!access) return notConnected("Google Calendar");
  return { content: await listCalendarEvents(access.accessToken, { from, to }) };
}

async function calendarCreateEvent(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = calendarCreateSchema.safeParse(input);
  if (!parsed.success) return invalid("calendar_create_event", parsed.error);
  if (Date.parse(parsed.data.end) <= Date.parse(parsed.data.start)) {
    return { content: "The event has to end after it starts.", isError: true };
  }
  if (!(await connectorAccess(ctx.organizationId, "google_calendar"))) return notConnected("Google Calendar");
  const { note, attendees, ...event } = parsed.data;
  return gateOrDeliver(ctx, {
    tool: "calendar_create_event",
    input: { ...event, attendees: attendees ? parseRecipients(attendees) : [] },
    note,
  });
}

async function slackPostMessage(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = slackSchema.safeParse(input);
  if (!parsed.success) return invalid("slack_post_message", parsed.error);
  if (!(await connectorAccess(ctx.organizationId, "slack"))) return notConnected("Slack");
  const { note, ...message } = parsed.data;
  return gateOrDeliver(ctx, { tool: "slack_post_message", input: message, note });
}

async function githubRead(input: unknown, ctx: RunContext): Promise<WorkToolOutcome> {
  const parsed = githubSchema.safeParse(input);
  if (!parsed.success) return invalid("github_read", parsed.error);
  const access = await connectorAccess(ctx.organizationId, "github");
  if (!access) return notConnected("GitHub");
  return { content: await readGithub(access.accessToken, parsed.data) };
}

export async function executeWorkTool(call: ToolCall, ctx: RunContext): Promise<WorkToolOutcome> {
  let outcome: WorkToolOutcome;
  if (!isWorkToolId(call.name)) {
    outcome = { content: `Unknown tool "${call.name}".`, isError: true };
  } else {
    try {
      switch (call.name) {
        case "search_documents":
          outcome = await searchDocumentsTool(call.input, ctx);
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
        case "delegate_to_colleague":
          outcome = await delegateToColleague(call.input, ctx);
          break;
        case "suggest_opportunity":
          outcome = await suggestOpportunity(call.input, ctx);
          break;
        case "escalate_to_human":
          outcome = await escalateToHuman(call.input, ctx);
          break;
        case "calendar_list_events":
          outcome = await calendarListEvents(call.input, ctx);
          break;
        case "calendar_create_event":
          outcome = await calendarCreateEvent(call.input, ctx);
          break;
        case "slack_post_message":
          outcome = await slackPostMessage(call.input, ctx);
          break;
        case "github_read":
          outcome = await githubRead(call.input, ctx);
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
      trigger: ctx.trigger,
      input: step.input as Prisma.InputJsonValue,
      result: step.output,
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
    if (!draft) return { ok: false, status: 0, detail: "The draft no longer exists." };
    const platform = (draft.metadata as { platform?: string } | null)?.platform;
    const webhook = await findPublishing(organizationId, platform);
    if (!webhook) return { ok: false, status: 0, detail: "No publishing integration is connected." };
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
  } else if (action.tool === "calendar_create_event") {
    const access = await connectorAccess(organizationId, "google_calendar");
    if (!access) return { ok: false, status: 0, detail: "Google Calendar is not connected." };
    delivery = await createCalendarEvent(access.accessToken, {
      summary: String(action.input.summary ?? ""),
      start: String(action.input.start ?? ""),
      end: String(action.input.end ?? ""),
      description: action.input.description ? String(action.input.description) : undefined,
      attendees: Array.isArray(action.input.attendees) ? (action.input.attendees as string[]) : [],
    });
  } else if (action.tool === "slack_post_message") {
    const access = await connectorAccess(organizationId, "slack");
    if (!access) return { ok: false, status: 0, detail: "Slack is not connected." };
    delivery = await postSlackMessage(access.accessToken, {
      channel: String(action.input.channel ?? ""),
      text: String(action.input.text ?? ""),
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
