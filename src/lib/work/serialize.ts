/** Wire shapes for the Work page. No server imports: the client renders these. */
import type { ActionStatus, PendingAction, WorkStep } from "./types";

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
  summary: string | null;
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
  approvedAt: string | null;
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
}
