import "server-only";
import type { Prisma } from "@prisma/client";
import { isPending } from "@/lib/work/suggestions";
import type { SuggestionDto } from "@/lib/work/serialize";
import { isSuggestionStatus } from "@/lib/work/types";

export const suggestionInclude = {
  agent: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.SuggestionInclude;

type Row = Prisma.SuggestionGetPayload<{ include: typeof suggestionInclude }>;

export function toSuggestionDto(row: Row, now = new Date()): SuggestionDto {
  return {
    id: row.id,
    agent: row.agent,
    actionItemId: row.actionItemId,
    summary: row.summary,
    rationale: row.rationale,
    proposal: row.proposal,
    ownerAction: row.ownerAction === "connect_integration" || row.ownerAction === "change_permission" ? row.ownerAction : null,
    status: isSuggestionStatus(row.status) ? row.status : "open",
    pending: isPending(row, now),
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
