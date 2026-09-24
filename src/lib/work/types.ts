/**
 * Shared vocabulary for autonomous work. No server imports: the Work page and
 * the scope-of-work form use these too.
 */

export const ACTION_STATUSES = [
  "queued",
  "in_progress",
  "needs_approval",
  "approved",
  "executing_external",
  "done",
  "failed",
  "rejected",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** The only moves the state machine allows. Everything else is a bug. */
export const TRANSITIONS: Record<ActionStatus, readonly ActionStatus[]> = {
  queued: ["in_progress", "failed"],
  in_progress: ["done", "failed", "needs_approval"],
  needs_approval: ["approved", "rejected"],
  approved: ["executing_external", "failed"],
  executing_external: ["done", "failed"],
  done: [],
  failed: [],
  // A rejection can be undone; the item simply waits for a decision again.
  rejected: ["needs_approval"],
};

export function canTransition(from: string, to: ActionStatus): boolean {
  return (TRANSITIONS[from as ActionStatus] ?? []).includes(to);
}

export const TRIGGER_TYPES = ["manual", "cron", "webhook"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const AUTONOMY_MODES = ["draft_only", "auto"] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

/** Per-tool overrides on top of the agent-level mode. */
export type ToolAutonomy = Partial<Record<"publish_post" | "send_email", AutonomyMode>>;

export function effectiveAutonomy(
  agentMode: AutonomyMode,
  overrides: ToolAutonomy | null | undefined,
  tool: "publish_post" | "send_email",
): AutonomyMode {
  return overrides?.[tool] ?? agentMode;
}

export const DRAFT_KINDS = ["blog_post", "social_caption", "email"] as const;

export const INTEGRATION_TYPES = ["webhook", "email"] as const;

/** How a run was started, as the Work list, approvals and the editor name it. */
export const TRIGGER_LABELS: Record<string, string> = {
  schedule: "Scheduled",
  webhook: "Triggered",
  manual: "Manual",
  followup: "Follow-up",
};

/** Human copy for statuses, used by the rough Work table now and the Inbox later. */
export const STATUS_LABELS: Record<ActionStatus, string> = {
  queued: "Queued",
  in_progress: "Running",
  needs_approval: "Needs approval",
  approved: "Approved",
  executing_external: "Sending",
  done: "Done",
  failed: "Failed",
  rejected: "Rejected",
};

/** A tool call as recorded on ActionItem.steps. */
export interface WorkStep {
  at: string;
  tool: string;
  /** Inputs with long strings trimmed; never secrets. */
  input: Record<string, unknown>;
  /** First few hundred characters of what the model saw back. */
  output: string;
  ok: boolean;
}

/** The external call an approval releases. Stored on ActionItem.pendingAction. */
export interface PendingAction {
  tool: "publish_post" | "send_email";
  input: Record<string, unknown>;
  draftId?: string;
  /** What the agent said it was doing, for the approver. */
  note?: string;
}

// --- reporting on itself ----------------------------------------------------

/** How often an agent rolls its runs up into one update. */
export const DIGEST_CADENCES = ["off", "daily", "weekly"] as const;
export type DigestCadence = (typeof DIGEST_CADENCES)[number];

export function isDigestCadence(value: string): value is DigestCadence {
  return (DIGEST_CADENCES as readonly string[]).includes(value);
}

export const DIGEST_CADENCE_LABELS: Record<DigestCadence, string> = {
  off: "Never - I'll check the Work page myself",
  daily: "Every morning",
  weekly: "Once a week, Monday morning",
};

/**
 * A digest line. `kind` is what the owner is being told, which is also the
 * order they are worth reading in: what needs a decision, then what is still
 * running, then what is finished.
 */
export const DIGEST_BULLET_KINDS = ["heads_up", "pending", "done"] as const;
export type DigestBulletKind = (typeof DIGEST_BULLET_KINDS)[number];

export interface DigestBullet {
  kind: DigestBulletKind;
  text: string;
}

export function isDigestBulletKind(value: unknown): value is DigestBulletKind {
  return typeof value === "string" && (DIGEST_BULLET_KINDS as readonly string[]).includes(value);
}

/** Counts behind a digest, so the card can show the shape of the period. */
export interface DigestStats {
  runs: number;
  completed: number;
  failed: number;
  awaitingApproval: number;
  drafts: number;
  suggestions: number;
}

export const SUGGESTION_STATUSES = ["open", "accepted", "dismissed", "snoozed"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export function isSuggestionStatus(value: string): value is SuggestionStatus {
  return (SUGGESTION_STATUSES as readonly string[]).includes(value);
}
