/**
 * Scope of work: reading and saving an agent's brief, and starting runs from
 * its triggers. The cron scheduler and the webhook route both end up in
 * `startRun`, which is the only place an action item is born.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { inngest } from "@/lib/jobs/client";
import { toStringArray } from "@/lib/agent-fields";
import { transition } from "./runner";
import type { AutonomyMode, TriggerType } from "./types";

export interface ScopeDto {
  agentId: string;
  context: string;
  objectives: string[];
  documentIds: string[];
  triggerType: TriggerType;
  cron: string | null;
  timezone: string;
  webhookToken: string | null;
  enabled: boolean;
  autonomy: AutonomyMode;
  lastFiredAt: string | null;
  /** The next scheduled fire time, for the editor. Null unless cron. */
  nextFireAt: string | null;
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

function nextFire(cron: string | null, timezone: string, from = new Date()): Date | null {
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
    lastFiredAt: Date | null;
  } | null,
  agentId: string,
): ScopeDto {
  if (!scope) {
    return {
      agentId,
      context: "",
      objectives: [],
      documentIds: [],
      triggerType: "manual",
      cron: null,
      timezone: "UTC",
      webhookToken: null,
      enabled: true,
      autonomy: "draft_only",
      lastFiredAt: null,
      nextFireAt: null,
    };
  }
  return {
    agentId: scope.agentId,
    context: scope.context,
    objectives: toStringArray(scope.objectives),
    documentIds: toStringArray(scope.documentIds),
    triggerType: scope.triggerType as TriggerType,
    cron: scope.cron,
    timezone: scope.timezone,
    webhookToken: scope.webhookToken,
    enabled: scope.enabled,
    autonomy: scope.autonomy as AutonomyMode,
    lastFiredAt: scope.lastFiredAt?.toISOString() ?? null,
    nextFireAt:
      scope.triggerType === "cron" && scope.enabled
        ? (nextFire(scope.cron, scope.timezone)?.toISOString() ?? null)
        : null,
  };
}

export interface ScopeInput {
  context: string;
  objectives: string[];
  documentIds: string[];
  triggerType: TriggerType;
  cron: string | null;
  timezone: string;
  enabled: boolean;
  autonomy: AutonomyMode;
}

export function newWebhookToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function saveScope(agentId: string, input: ScopeInput) {
  const existing = await prisma.scopeOfWork.findUnique({ where: { agentId } });
  // A webhook token is minted once and kept across edits, so a connected
  // system's URL keeps working when the owner tweaks the objectives.
  const webhookToken =
    input.triggerType === "webhook" ? (existing?.webhookToken ?? newWebhookToken()) : existing?.webhookToken ?? null;
  const data = {
    context: input.context,
    objectives: input.objectives as Prisma.InputJsonValue,
    documentIds: input.documentIds as Prisma.InputJsonValue,
    triggerType: input.triggerType,
    cron: input.triggerType === "cron" ? input.cron : null,
    timezone: input.timezone,
    webhookToken,
    enabled: input.enabled,
    autonomy: input.autonomy,
  };
  return prisma.scopeOfWork.upsert({
    where: { agentId },
    create: { agentId, ...data },
    update: data,
  });
}

export interface StartRunInput {
  agentId: string;
  trigger: "manual" | "schedule" | "webhook";
  payload?: Record<string, unknown>;
  /** Unique per scheduled tick; a duplicate returns null instead of a second run. */
  dedupeKey?: string;
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

  try {
    await inngest.send({ name: "work/action-item.run", data: { actionItemId: item.id } });
  } catch (error) {
    const reason = `Could not reach the job runtime: ${error instanceof Error ? error.message : "unknown error"}. Is Inngest running?`;
    await transition(item.id, "failed", { error: reason });
    return prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
  }
  return item;
}

/**
 * Called every minute by the scheduler function. Every enabled cron scope
 * whose most recent fire time has not been run yet gets exactly one run.
 * A missed minute (a deploy, a cold start) is caught up on the next tick;
 * an outage never replays every tick it missed.
 */
export async function fireDueScopes(now = new Date()): Promise<string[]> {
  const scopes = await prisma.scopeOfWork.findMany({
    where: { triggerType: "cron", enabled: true, cron: { not: null } },
    select: { id: true, agentId: true, cron: true, timezone: true, lastFiredAt: true, createdAt: true },
  });

  const started: string[] = [];
  for (const scope of scopes) {
    const due = previousFire(scope.cron!, scope.timezone, now);
    if (!due) continue;
    // Never fire a time that predates the schedule itself or the last run.
    const floor = scope.lastFiredAt ?? scope.createdAt;
    if (due <= floor) continue;

    const item = await startRun({
      agentId: scope.agentId,
      trigger: "schedule",
      payload: { firedAt: due.toISOString() },
      dedupeKey: `${scope.id}:${due.toISOString()}`,
      actor: { type: "schedule" },
    });
    await prisma.scopeOfWork.update({ where: { id: scope.id }, data: { lastFiredAt: due } });
    if (item) started.push(item.id);
  }
  return started;
}
