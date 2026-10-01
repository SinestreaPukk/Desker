import "server-only";
import type { Prisma } from "@prisma/client";
import type { CheckInAgentHealth, DigestBullet, ProjectCheckInDto, ProjectCheckInStats } from "@/lib/work/types";
import { isDigestBulletKind } from "@/lib/work/types";

export const checkInInclude = { project: { select: { id: true, name: true } } } satisfies Prisma.ProjectCheckInInclude;
type Row = Prisma.ProjectCheckInGetPayload<{ include: typeof checkInInclude }>;
const emptyStats: ProjectCheckInStats = { runs: 0, completed: 0, failed: 0, awaitingApproval: 0, drafts: 0, suggestions: 0, healthChanges: 0 };

function bulletsOf(value: unknown): DigestBullet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    return typeof row.text === "string" && row.text.trim() ? [{ kind: isDigestBulletKind(row.kind) ? row.kind : "done", text: row.text }] : [];
  });
}
function statsOf(value: unknown): ProjectCheckInStats {
  if (!value || typeof value !== "object") return emptyStats;
  const row = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(emptyStats).map((key) => [key, typeof row[key] === "number" ? row[key] : 0])) as unknown as ProjectCheckInStats;
}
function healthOf(value: unknown): CheckInAgentHealth[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.agentId !== "string" || typeof row.agentName !== "string" || typeof row.headline !== "string") return [];
    const tone = ["positive", "accent", "warning", "danger", "neutral"].includes(String(row.tone)) ? row.tone as CheckInAgentHealth["tone"] : "neutral";
    return [{ agentId: row.agentId, agentName: row.agentName, avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : null, tone, headline: row.headline, detail: typeof row.detail === "string" ? row.detail : "", changed: row.changed === true, previousHeadline: typeof row.previousHeadline === "string" ? row.previousHeadline : null }];
  });
}
export function toCheckInDto(row: Row, suggestions: ProjectCheckInDto["suggestions"]): ProjectCheckInDto {
  return {
    id: row.id,
    project: row.project,
    cadence: row.cadence === "daily" ? "daily" : "weekly",
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    headline: row.headline,
    bullets: bulletsOf(row.bullets),
    stats: statsOf(row.stats),
    agentHealth: healthOf(row.agentHealth),
    actionItemIds: Array.isArray(row.actionItemIds) ? (row.actionItemIds as unknown[]).filter((id): id is string => typeof id === "string") : [],
    suggestions,
    readAt: row.readAt?.toISOString() ?? null,
    emailedAt: row.emailedAt?.toISOString() ?? null,
    emailError: row.emailError,
    createdAt: row.createdAt.toISOString(),
  };
}
