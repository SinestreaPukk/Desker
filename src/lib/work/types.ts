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

export const TERMINAL_STATUSES: readonly ActionStatus[] = ["done", "failed", "rejected"];

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
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const INTEGRATION_TYPES = ["webhook", "email"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

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
