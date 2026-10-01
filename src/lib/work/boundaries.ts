/**
 * What an agent can and cannot do, in the owner's words - derived from the
 * same scope settings the runner gates on (its tool list, its mode, and the
 * per-tool overrides), so the card can never promise more than is enforced.
 *
 * Pure and shared so the agent page and its test read the same sentences.
 */
import { WORK_TOOL_IDS, type WorkToolId } from "./tools";
import { effectiveAutonomy, GATED_TOOL_IDS, type AutonomyMode, type GatedToolId, type ToolAutonomy } from "./types";

/** null: housekeeping every agent has, not worth a line on its card. */
const CAN: Record<Exclude<WorkToolId, GatedToolId>, string | null> = {
  search_documents: "Look things up in the documents you gave it",
  review_spending: "Add up the statements you uploaded, exactly",
  web_research: "Research the web and cite its sources",
  draft_content: "Write drafts for you to review",
  github_read: "Read the GitHub repositories you shared",
  social_read: "Read your social posts, likes and comments",
  calendar_list_events: "Check your calendar",
  inbox_read: "Read your inbox",
  schedule_followup: null,
  delegate_to_colleague: "Hand work to a colleague on your roster",
  suggest_opportunity: null,
  escalate_to_human: null, // the card shows its escalation rule instead
};

const REACHES_OUT: Record<GatedToolId, string> = {
  send_email: "Send emails",
  publish_post: "Publish posts",
  calendar_create_event: "Add calendar events",
  calendar_reschedule: "Move calendar events",
  inbox_reply: "Reply to emails",
  slack_post_message: "Post to Slack",
  github_write: "Change GitHub: commits, pull requests and issues",
  social_manage: "Edit or delete your social posts",
};

/** True everywhere: there is no tool for it. */
const NEVER = "Spend money, sign or agree to anything";

export function describeBoundaries(scope: {
  tools: readonly WorkToolId[] | null;
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy | null;
}): { can: string[]; cannot: string[] } {
  const tools = new Set(scope.tools ?? WORK_TOOL_IDS);
  const can: string[] = [];
  const cannot: string[] = [];

  for (const tool of WORK_TOOL_IDS) {
    if (tool in REACHES_OUT) continue;
    const line = CAN[tool as keyof typeof CAN];
    if (line && tools.has(tool)) can.push(line);
  }
  // Only what this agent has: a tool it was never given isn't worth listing.
  for (const tool of GATED_TOOL_IDS) {
    if (!tools.has(tool)) continue;
    const action = REACHES_OUT[tool];
    if (effectiveAutonomy(scope.autonomy, scope.toolAutonomy, tool) === "auto") can.push(`${action} without asking you`);
    else cannot.push(`${action} without your approval`);
  }
  return { can, cannot: [...cannot, NEVER] };
}
