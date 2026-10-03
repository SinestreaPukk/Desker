/**
 * Scope of work: reading and saving an agent's brief, and starting runs from
 * its triggers. The cron scheduler and the webhook route both end up in
 * `startRun`, which is the only place an action item is born.
 */
import { OrganizationRateLimited, limitOrganization } from "@/lib/platform/rate-limit";
import { scopeTools, type WorkToolId } from "./tools";
import "server-only";
import { randomBytes } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { audit } from "@/lib/platform/audit";
import { inngest } from "@/lib/jobs/client";
import { toStringArray } from "@/lib/agents/agent-fields";
import { afterResponse } from "@/lib/platform/after-response";
import { runActionItem, inlineSteps } from "./runner";
import { isDigestCadence, type AutonomyMode, type DigestCadence, type ToolAutonomy, type TriggerType } from "./types";
import {
  AGENT_CONTEXT_QUESTIONS,
  answersFor,
  composeContext,
  toContextAnswers,
  type ContextAnswers,
} from "./context";

export class RunRefused extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RunRefused";
  }
}

export interface ScopeDto {
  agentId: string;
  /** The composed string a run reads. Derived from `contextAnswers`. */
  context: string;
  /** The guided answers behind it, which is what the editor edits. */
  contextAnswers: ContextAnswers;
  objectives: string[];
  documentIds: string[];
  triggerType: TriggerType;
  cron: string | null;
  timezone: string;
  webhookToken: string | null;
  enabled: boolean;
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy | null;
  /** Null means every work tool. */
  tools: WorkToolId[] | null;
  lastFiredAt: string | null;
  /** The next scheduled fire time, for the editor. Null unless cron. */
  nextFireAt: string | null;
  /** How often the agent reports on itself. */
  digestCadence: DigestCadence;
  digestEmail: boolean;
  /** Comma-separated addresses, or "" for the organisation's owners and admins. */
  digestRecipients: string;
  lastDigestAt: string | null;
}

export function validCron(cron: string, timezone = "UTC"): boolean {
  try {
    CronExpressionParser.parse(cron, { tz: timezone });
    return true;
  } catch {
    return false;
  }
}

export function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function nextFire(cron: string | null, timezone: string, from = new Date()): Date | null {
  if (!cron) return null;
  try {
    return CronExpressionParser.parse(cron, { tz: timezone, currentDate: from }).next().toDate();
  } catch {
    return null;
  }
}

/** The most recent fire time at or before `now`. */
export function previousFire(cron: string, timezone: string, now = new Date()): Date | null {
  try {
    return CronExpressionParser.parse(cron, { tz: timezone, currentDate: now }).prev().toDate();
  } catch {
    return null;
  }
}

export function toScopeDto(
  scope: {
    agentId: string;
    context: string;
    objectives: unknown;
    documentIds: unknown;
    triggerType: string;
    cron: string | null;
    timezone: string;
    webhookToken: string | null;
    enabled: boolean;
    autonomy: string;
    toolAutonomy: unknown;
    tools: unknown;
    contextAnswers: unknown;
    lastFiredAt: Date | null;
    digestCadence: string;
    digestEmail: boolean;
    digestRecipients: string | null;
    lastDigestAt: Date | null;
  } | null,
  agentId: string,
): ScopeDto {
  if (!scope) {
    return {
      agentId,
      context: "",
      contextAnswers: {},
      objectives: [],
      documentIds: [],
      triggerType: "manual",
      cron: null,
      timezone: "UTC",
      webhookToken: null,
      enabled: true,
      autonomy: "draft_only",
      toolAutonomy: null,
      tools: null,
      lastFiredAt: null,
      nextFireAt: null,
      digestCadence: "weekly",
      digestEmail: false,
      digestRecipients: "",
      lastDigestAt: null,
    };
  }
  return {
    agentId: scope.agentId,
    context: scope.context,
    // A scope written before the questions existed still opens with its text
    // in the first field rather than with four empty boxes.
    contextAnswers: answersFor(scope.contextAnswers, scope.context, AGENT_CONTEXT_QUESTIONS),
    objectives: toStringArray(scope.objectives),
    documentIds: toStringArray(scope.documentIds),
    triggerType: scope.triggerType as TriggerType,
    cron: scope.cron,
    timezone: scope.timezone,
    webhookToken: scope.webhookToken,
    enabled: scope.enabled,
    autonomy: scope.autonomy as AutonomyMode,
    toolAutonomy: (scope.toolAutonomy as ToolAutonomy | null) ?? null,
    tools: scopeTools(scope.tools),
    lastFiredAt: scope.lastFiredAt?.toISOString() ?? null,
    nextFireAt:
      scope.triggerType === "cron" && scope.enabled
        ? (nextFire(scope.cron, scope.timezone)?.toISOString() ?? null)
        : null,
    digestCadence: isDigestCadence(scope.digestCadence) ? scope.digestCadence : "weekly",
    digestEmail: scope.digestEmail,
    digestRecipients: scope.digestRecipients ?? "",
    lastDigestAt: scope.lastDigestAt?.toISOString() ?? null,
  };
}

interface ScopeInput {
  /**
   * The composed string. Ignored when `contextAnswers` is given: the answers
   * are the source of truth and the string is derived from them, so the two
   * cannot drift apart.
   */
  context: string;
  contextAnswers?: ContextAnswers;
  objectives: string[];
  documentIds: string[];
  triggerType: TriggerType;
  cron: string | null;
  timezone: string;
  enabled: boolean;
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy | null;
  tools: WorkToolId[] | null;
  /**
   * Digest settings are optional: a caller that does not manage them (a
   * template, a test, a future importer) leaves what the agent already has
   * rather than silently resetting it to the default.
   */
  digestCadence?: DigestCadence;
  digestEmail?: boolean;
  /** "" means the organisation's owners and admins. */
  digestRecipients?: string;
}

function newWebhookToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function saveScope(agentId: string, input: ScopeInput) {
  const existing = await prisma.scopeOfWork.findUnique({ where: { agentId } });
  // A webhook token is minted once and kept across edits, so a connected
  // system's URL keeps working when the owner tweaks the objectives.
  const webhookToken =
    input.triggerType === "webhook" ? (existing?.webhookToken ?? newWebhookToken()) : existing?.webhookToken ?? null;
  // The answers win when they are given, and are left alone when they are
  // not: a caller that only knows about the composed string (a template, a
  // test) must not wipe what the editor wrote.
  const answers = input.contextAnswers
    ? toContextAnswers(input.contextAnswers, AGENT_CONTEXT_QUESTIONS)
    : null;
  const data = {
    // Answers given: compose. No answers but a string: a legacy caller setting
    // it directly. Neither: leave what is there, so saving the rest of the
    // scope does not silently empty the context.
    context: answers
      ? composeContext(answers, AGENT_CONTEXT_QUESTIONS)
      : input.context || existing?.context || "",
    ...(answers ? { contextAnswers: answers as Prisma.InputJsonValue } : {}),
    objectives: input.objectives as Prisma.InputJsonValue,
    documentIds: input.documentIds as Prisma.InputJsonValue,
    triggerType: input.triggerType,
    cron: input.triggerType === "cron" ? input.cron : null,
    timezone: input.timezone,
    webhookToken,
    enabled: input.enabled,
    autonomy: input.autonomy,
    toolAutonomy: (input.toolAutonomy ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
    tools: (input.tools ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
    digestCadence: input.digestCadence ?? existing?.digestCadence ?? "weekly",
    digestEmail: input.digestEmail ?? existing?.digestEmail ?? false,
    digestRecipients:
      input.digestRecipients === undefined
        ? (existing?.digestRecipients ?? null)
        : input.digestRecipients.trim() || null,
  };
  return prisma.scopeOfWork.upsert({
    where: { agentId },
    create: { agentId, ...data },
    update: data,
  });
}

interface StartRunInput {
  agentId: string;
  trigger: "manual" | "schedule" | "webhook";
  payload?: Record<string, unknown>;
  /** Unique per scheduled tick; a duplicate returns null instead of a second run. */
  dedupeKey?: string;
  /** The run this one continues (a retry). */
  parentId?: string;
  actor?: { type: "user" | "schedule" | "system"; id?: string };
}

/**
 * Creates the action item and hands it to the job runtime. If the runtime
 * cannot be reached the item is failed with a clear reason rather than left
 * queued forever with no explanation.
 */
export async function startRun(input: StartRunInput) {
  const agent = await prisma.agent.findUnique({
    where: { id: input.agentId },
    select: { id: true, project: { select: { organizationId: true } } },
  });
  if (!agent) return null;

  // Fairness: a person or an outside system starting runs in a burst is
  // refused past the organisation's share. Schedules and follow-ups are not -
  // the job runtime throttles them per organisation instead, delaying rather
  // than dropping, so a busy 9am never silently loses a run.
  if (input.trigger === "manual" || input.trigger === "webhook") {
    try {
      await limitOrganization(agent.project.organizationId, "runs");
    } catch (error) {
      if (error instanceof OrganizationRateLimited) throw new RunRefused(error.message, error.retryAfterSeconds);
      throw error;
    }
  }

  let item;
  try {
    item = await prisma.actionItem.create({
      data: {
        organizationId: agent.project.organizationId,
        agentId: agent.id,
        type: "scope_run",
        trigger: input.trigger,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey ?? null,
        parentId: input.parentId ?? null,
      },
    });
  } catch (error) {
    // The unique dedupeKey caught a tick that was already turned into a run.
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  }

  await audit({
    organizationId: agent.project.organizationId,
    actorType: input.actor?.type ?? "system",
    actorId: input.actor?.id ?? null,
    action: "action_item.created",
    targetType: "action_item",
    targetId: item.id,
    metadata: { trigger: input.trigger, agentId: agent.id },
  });

  await dispatchRun(item.id, agent.project.organizationId);
  return item;
}

/**
 * Hands a created action item to the job runtime. If the runtime cannot be
 * reached (local dev, self-hosting without Inngest) it runs inline after the
 * response, so a run never stalls on plumbing. One implementation for every
 * way a run is born: a start, a hand-off, a workflow step.
 */
export async function dispatchRun(actionItemId: string, organizationId: string): Promise<void> {
  try {
    await inngest.send({ name: "work/action-item.run", data: { actionItemId, organizationId } });
  } catch (error) {
    console.warn("[dispatchRun] inngest.send failed, executing inline via afterResponse:", error);
    afterResponse(async () => {
      try {
        await runActionItem(actionItemId, inlineSteps);
      } catch (err) {
        console.error(`[dispatchRun:afterResponse] execution failed for item ${actionItemId}:`, err);
      }
    });
  }
}

/** One schedule tick that is due and has been claimed, ready to become a run. */
export interface DueScope {
  scopeId: string;
  agentId: string;
  organizationId: string;
  /** ISO time of the tick being fired. */
  due: string;
  /** Set when the tick belongs to one of the agent's routines rather than its single schedule. */
  routineId?: string;
  instruction?: string;
}

/**
 * Finds every schedule whose last tick has not produced a run yet, and claims
 * each tick with a conditional update so that two overlapping scheduler runs -
 * or two instances - can never both fire it. Cheap: one read for all
 * schedules, one small write per due one.
 */
export async function claimDueScopes(now = new Date()): Promise<DueScope[]> {
  const scopes = await prisma.scopeOfWork.findMany({
    where: { triggerType: "cron", enabled: true, cron: { not: null } },
    select: {
      id: true,
      agentId: true,
      cron: true,
      timezone: true,
      lastFiredAt: true,
      createdAt: true,
      agent: { select: { project: { select: { organizationId: true } } } },
    },
  });

  const claimed: DueScope[] = [];
  for (const scope of scopes) {
    const due = previousFire(scope.cron!, scope.timezone, now);
    if (!due) continue;
    // Never fire a time that predates the schedule itself or the last run.
    const floor = scope.lastFiredAt ?? scope.createdAt;
    if (due <= floor) continue;
    const won = await prisma.scopeOfWork.updateMany({
      where: {
        id: scope.id,
        OR: [{ lastFiredAt: null }, { lastFiredAt: { lt: due } }],
      },
      data: { lastFiredAt: due },
    });
    if (won.count === 0) continue;
    claimed.push({
      scopeId: scope.id,
      agentId: scope.agentId,
      organizationId: scope.agent.project.organizationId,
      due: due.toISOString(),
    });
  }

  // Routines: the same claim, one per scheduled job.
  const routines = await prisma.routine.findMany({
    where: { enabled: true, agent: { status: "published" } },
    select: {
      id: true,
      agentId: true,
      cron: true,
      timezone: true,
      instruction: true,
      lastFiredAt: true,
      createdAt: true,
      agent: { select: { project: { select: { organizationId: true } } } },
    },
  });
  for (const routine of routines) {
    const due = previousFire(routine.cron, routine.timezone, now);
    if (!due) continue;
    if (due <= (routine.lastFiredAt ?? routine.createdAt)) continue;
    const won = await prisma.routine.updateMany({
      where: { id: routine.id, OR: [{ lastFiredAt: null }, { lastFiredAt: { lt: due } }] },
      data: { lastFiredAt: due },
    });
    if (won.count === 0) continue;
    claimed.push({
      scopeId: routine.id,
      routineId: routine.id,
      instruction: routine.instruction,
      agentId: routine.agentId,
      organizationId: routine.agent.project.organizationId,
      due: due.toISOString(),
    });
  }
  return claimed;
}

/**
 * Turns one claimed tick into a run. Safe to retry: the dedupe key makes a
 * second attempt for the same tick a no-op. A plan refusal consumes the tick
 * (no catch-up storm later) and is already on the audit record.
 */
export async function fireScope(tick: DueScope): Promise<string | null> {
  try {
    const item = await startRun({
      agentId: tick.agentId,
      trigger: "schedule",
      payload: { firedAt: tick.due, ...(tick.instruction ? { instruction: tick.instruction } : {}) },
      dedupeKey: `${tick.routineId ?? tick.scopeId}:${tick.due}`,
      actor: { type: "schedule" },
    });
    return item?.id ?? null;
  } catch (error) {
    if (error instanceof RunRefused) return null;
    throw error;
  }
}

/** Claim and fire in one go, for tests and deployments without the job runtime's fan-out. */
export async function fireDueScopes(now = new Date()): Promise<string[]> {
  const started: string[] = [];
  for (const tick of await claimDueScopes(now)) {
    const id = await fireScope(tick);
    if (id) started.push(id);
  }
  return started;
}
