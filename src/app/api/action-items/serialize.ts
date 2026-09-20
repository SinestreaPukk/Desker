import "server-only";
import type { Prisma } from "@prisma/client";
import type { ActionItemDto, DraftDto } from "@/lib/work/serialize";
import type { ActionStatus, PendingAction, WorkStep } from "@/lib/work/types";

export const actionItemInclude = {
  agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
  drafts: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ActionItemInclude;

type Row = Prisma.ActionItemGetPayload<{ include: typeof actionItemInclude }>;

export function toDraftDto(draft: Row["drafts"][number]): DraftDto {
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
    summary: typeof result.summary === "string" ? result.summary : null,
    findings: (result.findings as ActionItemDto["findings"] | undefined) ?? [],
    external: (result.external as ActionItemDto["external"] | undefined) ?? null,
    pendingAction: (item.pendingAction as unknown as PendingAction | null) ?? null,
    steps: (item.steps as unknown as WorkStep[] | null) ?? [],
    drafts: item.drafts.map(toDraftDto),
    followupIds: (result.followupIds as string[] | undefined) ?? [],
    parentId: item.parentId,
    error: item.error,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    scheduledFor: item.scheduledFor?.toISOString() ?? null,
    awaitingSince: item.awaitingSince?.toISOString() ?? null,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    escalatedAt: item.escalatedAt?.toISOString() ?? null,
    escalationReason: item.escalationReason,
    createdAt: item.createdAt.toISOString(),
    startedAt: item.startedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
  };
}
