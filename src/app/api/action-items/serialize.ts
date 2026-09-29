import "server-only";
import type { Prisma } from "@prisma/client";
import type { ActionItemDto, DraftDto } from "@/lib/work/serialize";
import type { ActionStatus, PendingAction, WorkStep } from "@/lib/work/types";

export const actionItemInclude = {
  agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
  drafts: { orderBy: { createdAt: "asc" as const } },
  parent: { select: { agent: { select: { id: true, name: true, avatarUrl: true } } } },
  // A flag or a failure stays on the owner's plate until they mark it handled.
  issues: { where: { status: "open", type: { in: ["escalation", "failure"] } }, select: { id: true } },
  followups: {
    where: { type: "colleague_delegation" },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      status: true,
      headline: true,
      summary: true,
      payload: true,
      agent: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ActionItemInclude;

type Row = Prisma.ActionItemGetPayload<{ include: typeof actionItemInclude }>;

function toDraftDto(draft: Row["drafts"][number]): DraftDto {
  return {
    id: draft.id,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    metadata: (draft.metadata as Record<string, unknown> | null) ?? null,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
  };
}

export function toActionItemDto(item: Row): ActionItemDto {
  const result = (item.result as Record<string, unknown> | null) ?? {};
  return {
    id: item.id,
    agent: item.agent,
    status: item.status as ActionStatus,
    type: item.type,
    trigger: item.trigger,
    headline: item.headline,
    task: taskOf(item.payload) || null,
    // The owner's summary is written a step after the run finishes, so a run
    // still in flight falls back to the agent's own report rather than showing
    // an empty row.
    summary: item.summary ?? (typeof result.summary === "string" ? result.summary : null),
    report: typeof result.summary === "string" ? result.summary : null,
    findings: (result.findings as ActionItemDto["findings"] | undefined) ?? [],
    external: (result.external as ActionItemDto["external"] | undefined) ?? null,
    pendingAction: (item.pendingAction as unknown as PendingAction | null) ?? null,
    steps: (item.steps as unknown as WorkStep[] | null) ?? [],
    drafts: item.drafts.map(toDraftDto),
    followupIds: (result.followupIds as string[] | undefined) ?? [],
    parentId: item.parentId,
    collab: {
      askedBy:
        item.type === "colleague_delegation" && item.parent
          ? { agent: item.parent.agent, task: taskOf(item.payload), context: contextOf(item.payload) }
          : null,
      handoffs: item.followups.map((handoff) => ({
        id: handoff.id,
        agent: handoff.agent,
        task: taskOf(handoff.payload),
        status: handoff.status as ActionStatus,
        reply: handoff.headline ?? handoff.summary,
      })),
    },
    error: item.error,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    scheduledFor: item.scheduledFor?.toISOString() ?? null,
    awaitingSince: item.awaitingSince?.toISOString() ?? null,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    escalatedAt: item.escalatedAt?.toISOString() ?? null,
    escalationReason: item.escalationReason,
    openIssueIds: item.issues.map((issue) => issue.id),
    createdAt: item.createdAt.toISOString(),
    startedAt: item.startedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
  };
}

/** A follow-up's or hand-off's objective, or what the owner typed when they pressed Run now. */
function taskOf(payload: Prisma.JsonValue): string {
  const record = payload as Record<string, unknown> | null;
  const value = record?.objective ?? record?.instruction;
  return typeof value === "string" ? value : "";
}

function contextOf(payload: Prisma.JsonValue): string {
  const value = (payload as Record<string, unknown> | null)?.context;
  return typeof value === "string" ? value : "";
}
