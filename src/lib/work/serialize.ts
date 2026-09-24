/** Wire shapes for the Work page. No server imports: the client renders these. */
import type {
  ActionStatus,
  DigestBullet,
  DigestCadence,
  DigestStats,
  PendingAction,
  SuggestionStatus,
  WorkStep,
} from "./types";

export interface DraftDto {
  id: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

export interface ActionItemDto {
  id: string;
  agent: { id: string; name: string; jobTitle: string; avatarUrl: string | null };
  status: ActionStatus;
  type: string;
  trigger: string;
  /** One line for a list row. Null on runs that finished before digests existed. */
  headline: string | null;
  /** The plain-language account, written for the owner. Shown first. */
  summary: string | null;
  /** The agent's own technical report. Kept underneath the summary. */
  report: string | null;
  findings: { query: string; findings: string; sources: { title: string; url: string }[] }[];
  external: { ok: boolean; status: number; detail: string } | null;
  pendingAction: PendingAction | null;
  steps: WorkStep[];
  drafts: DraftDto[];
  followupIds: string[];
  parentId: string | null;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  scheduledFor: string | null;
  awaitingSince: string | null;
  approvedAt: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface IntegrationDto {
  id: string;
  type: string;
  name: string;
  /** Non-secret preview only: a hostname or a from-address. */
  summary: string;
  enabled: boolean;
  createdAt: string;
  /** connected | attention | disconnected - see lib/work/integration-health.ts. */
  state: "connected" | "attention" | "disconnected";
  /** What it means for the agents that use it, in one line. */
  consequence: string;
  lastDeliveryAt: string | null;
  lastDeliveryOk: boolean | null;
  /** False for a spare: agents use the oldest working connector of each kind. */
  active: boolean;
}

export interface DigestDto {
  id: string;
  agent: { id: string; name: string; jobTitle: string; avatarUrl: string | null };
  cadence: DigestCadence;
  periodStart: string;
  periodEnd: string;
  headline: string;
  bullets: DigestBullet[];
  stats: DigestStats;
  actionItemIds: string[];
  readAt: string | null;
  emailedAt: string | null;
  emailError: string | null;
  createdAt: string;
}

export interface SuggestionDto {
  id: string;
  agent: { id: string; name: string; avatarUrl: string | null };
  actionItemId: string | null;
  summary: string;
  rationale: string;
  proposal: string;
  status: SuggestionStatus;
  /** True when it is waiting on a decision - open, or snoozed past its date. */
  pending: boolean;
  snoozedUntil: string | null;
  acceptedAt: string | null;
  createdAt: string;
}
