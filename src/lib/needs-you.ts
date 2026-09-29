/**
 * What Needs you holds, and how a raised issue is sorted into it. Shared by
 * the queue, the sidebar count and the tests, so the three always agree on
 * what "needs a person" means.
 */
export const NEEDS_YOU_KINDS = ["approval", "escalation", "failure", "question", "reported"] as const;
export type NeedsYouKind = (typeof NEEDS_YOU_KINDS)[number];

/** An agent stopping, a run failing, or something reported in a chat. */
export function needsYouKind(issue: { type: string }): "escalation" | "failure" | "reported" {
  if (issue.type === "escalation") return "escalation";
  if (issue.type === "failure") return "failure";
  return "reported";
}

/** How many things wait on a person: the number beside Needs you in the sidebar. */
export function waitingCount(input: {
  approvals: number;
  openIssues: number;
  pendingSuggestions: number;
}): number {
  return input.approvals + input.openIssues + input.pendingSuggestions;
}
