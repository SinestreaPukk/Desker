import "server-only";
import type { Prisma } from "@prisma/client";
import type { DigestDto } from "@/lib/work/serialize";
import {
  isDigestBulletKind,
  isDigestCadence,
  type DigestBullet,
  type DigestStats,
} from "@/lib/work/types";

export const digestInclude = {
  agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
} satisfies Prisma.DigestInclude;

type Row = Prisma.DigestGetPayload<{ include: typeof digestInclude }>;

const EMPTY_STATS: DigestStats = {
  runs: 0,
  completed: 0,
  failed: 0,
  awaitingApproval: 0,
  drafts: 0,
  suggestions: 0,
};

/** Json columns are `unknown` to the client; re-check their shape on the way out. */
function toBullets(value: unknown): DigestBullet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.text !== "string" || !record.text.trim()) return [];
    return [{ kind: isDigestBulletKind(record.kind) ? record.kind : "done", text: record.text }];
  });
}

function toStats(value: unknown): DigestStats {
  if (!value || typeof value !== "object") return EMPTY_STATS;
  const record = value as Record<string, unknown>;
  const read = (key: keyof DigestStats) =>
    typeof record[key] === "number" && Number.isFinite(record[key]) ? (record[key] as number) : 0;
  return {
    runs: read("runs"),
    completed: read("completed"),
    failed: read("failed"),
    awaitingApproval: read("awaitingApproval"),
    drafts: read("drafts"),
    suggestions: read("suggestions"),
  };
}

export function toDigestDto(digest: Row): DigestDto {
  return {
    id: digest.id,
    agent: digest.agent,
    cadence: isDigestCadence(digest.cadence) ? digest.cadence : "weekly",
    periodStart: digest.periodStart.toISOString(),
    periodEnd: digest.periodEnd.toISOString(),
    headline: digest.headline,
    bullets: toBullets(digest.bullets),
    stats: toStats(digest.stats),
    actionItemIds: Array.isArray(digest.actionItemIds)
      ? (digest.actionItemIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
    readAt: digest.readAt?.toISOString() ?? null,
    emailedAt: digest.emailedAt?.toISOString() ?? null,
    emailError: digest.emailError,
    createdAt: digest.createdAt.toISOString(),
  };
}
