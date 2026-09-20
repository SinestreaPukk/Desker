/**
 * How the three kinds of raised item are presented.
 *
 * Kept in one place so the inbox list and the conversation detail cannot drift
 * apart on what an escalation looks like.
 */
export type IssueKind = "issue" | "suggestion" | "escalation";

export const ISSUE_KINDS: Record<
  IssueKind,
  { label: string; tone: "neutral" | "accent" | "danger"; icon: "bug" | "lightbulb" | "handoff" }
> = {
  issue: { label: "Issue", tone: "neutral", icon: "bug" },
  suggestion: { label: "Suggestion", tone: "accent", icon: "lightbulb" },
  escalation: { label: "Escalated", tone: "danger", icon: "handoff" },
};

export function issueKind(type: string): IssueKind {
  return type === "suggestion" || type === "escalation" ? type : "issue";
}
