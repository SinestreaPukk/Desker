/**
 * What an owner can do with a recommendation.
 *
 * A suggestion is not a task result, so it does not get resolved like an
 * issue - it gets decided. Accept turns the proposal into a standing objective
 * on the agent's scope of work, which is the whole point: the agent noticed
 * something, and saying yes is what makes it part of the job rather than a
 * note someone has to remember to act on. Dismiss closes it. Snooze puts it
 * back in front of the owner later, because "not this week" is the honest
 * answer to most good ideas.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { publishAdminEvent } from "@/lib/events";
import { toStringArray } from "@/lib/agent-fields";
import type { SuggestionStatus } from "./types";

/** How long "remind me later" lasts when no explicit period is given. */
export const DEFAULT_SNOOZE_DAYS = 7;
export const MAX_SNOOZE_DAYS = 90;

/**
 * The filter for "what is in front of the owner": open, plus anything whose
 * snooze has run out. A lapsed snooze is not a separate state to clean up on
 * a schedule - it simply reads as open again.
 */
export function pendingSuggestionFilter(now = new Date()): Prisma.SuggestionWhereInput {
  return {
    OR: [{ status: "open" }, { status: "snoozed", snoozedUntil: { lte: now } }],
  };
}

/** True when this row should be shown as waiting on a decision. */
export function isPending(
  suggestion: { status: string; snoozedUntil: Date | null },
  now = new Date(),
): boolean {
  if (suggestion.status === "open") return true;
  return suggestion.status === "snoozed" && Boolean(suggestion.snoozedUntil && suggestion.snoozedUntil <= now);
}

export interface DecideInput {
  suggestionId: string;
  status: SuggestionStatus;
  /** Snooze only. Defaults to a week, capped at ninety days. */
  snoozeDays?: number;
  userId: string;
}

export interface DecideResult {
  id: string;
  status: SuggestionStatus;
  snoozedUntil: string | null;
  /** Set when accepting added the proposal to the agent's objectives. */
  addedObjective: string | null;
  agentId: string;
}

/**
 * Records the owner's decision. Accepting appends the proposal to the agent's
 * scope of work, creating the scope row if the agent never had one, so the
 * next scheduled run carries it out without anyone opening the editor.
 */
export async function decideSuggestion(input: DecideInput): Promise<DecideResult | null> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: input.suggestionId },
    select: {
      id: true,
      organizationId: true,
      agentId: true,
      proposal: true,
      summary: true,
      status: true,
    },
  });
  if (!suggestion) return null;

  const snoozedUntil =
    input.status === "snoozed"
      ? new Date(
          Date.now() +
            Math.min(Math.max(input.snoozeDays ?? DEFAULT_SNOOZE_DAYS, 1), MAX_SNOOZE_DAYS) * 86_400_000,
        )
      : null;

  let addedObjective: string | null = null;
  if (input.status === "accepted") {
    addedObjective = await addObjective(suggestion.agentId, suggestion.proposal);
  }

  const updated = await prisma.suggestion.update({
    where: { id: suggestion.id },
    data: {
      status: input.status,
      snoozedUntil,
      ...(input.status === "accepted"
        ? { acceptedAt: new Date(), acceptedById: input.userId }
        : { acceptedAt: null, acceptedById: null }),
    },
    select: { id: true, status: true, snoozedUntil: true, agentId: true },
  });

  publishAdminEvent({ type: "suggestion.updated", suggestionId: updated.id });
  await audit({
    organizationId: suggestion.organizationId,
    actorType: "user",
    actorId: input.userId,
    action: `suggestion.${input.status}`,
    targetType: "suggestion",
    targetId: suggestion.id,
    metadata: {
      summary: suggestion.summary.slice(0, 300),
      ...(addedObjective ? { addedObjective } : {}),
      ...(snoozedUntil ? { until: snoozedUntil.toISOString() } : {}),
    },
  });

  return {
    id: updated.id,
    status: updated.status as SuggestionStatus,
    snoozedUntil: updated.snoozedUntil?.toISOString() ?? null,
    addedObjective,
    agentId: updated.agentId,
  };
}

/**
 * Adds the proposal to the agent's standing objectives. Returns what was
 * added, or null when the objective was already there - accepting the same
 * idea twice must not give the agent the same instruction twice.
 */
async function addObjective(agentId: string, proposal: string): Promise<string | null> {
  const objective = proposal.trim();
  if (!objective) return null;

  const scope = await prisma.scopeOfWork.findUnique({
    where: { agentId },
    select: { objectives: true },
  });
  const existing = scope ? toStringArray(scope.objectives) : [];
  if (existing.some((entry) => entry.toLowerCase() === objective.toLowerCase())) return null;

  const objectives = [...existing, objective] as Prisma.InputJsonValue;
  if (scope) {
    await prisma.scopeOfWork.update({ where: { agentId }, data: { objectives } });
  } else {
    await prisma.scopeOfWork.create({
      data: { agentId, objectives, documentIds: [] as Prisma.InputJsonValue },
    });
  }
  return objective;
}
