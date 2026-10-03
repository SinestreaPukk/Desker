/**
 * What the assistant may do, as a short list of plain abilities instead of
 * twenty-seven tool ids. Each ability switches a group of work tools on or off;
 * the core ones (search files, draft, remind, ask you) are always on.
 * Pure: the settings screen and the tests share it.
 */
import type { WorkToolId } from "@/lib/work/tools";

export interface Ability {
  id: string;
  label: string;
  hint: string;
  tools: readonly WorkToolId[];
  /** Integration types, any one of which makes it usable. */
  needs?: readonly string[];
  /** What to connect, in the owner's words. */
  needsLabel?: string;
}

export const ABILITIES: readonly Ability[] = [
  { id: "web", label: "Search the web", hint: "Look things up for you.", tools: ["web_research"] },
  {
    id: "browser",
    label: "Use a browser for you",
    hint: "Finds flights and prices, fills in forms and signs you up. It never pays or books.",
    tools: ["browse_web", "browse_commit"],
  },
  {
    id: "email",
    label: "Read and reply to email",
    hint: "Drafts replies. You approve before anything is sent.",
    tools: ["inbox_read", "inbox_reply", "send_email"],
    needs: ["gmail", "outlook_mail", "email"],
    needsLabel: "Gmail",
  },
  {
    id: "calendar",
    label: "Manage your calendar",
    hint: "See your week and suggest changes. You approve each change.",
    tools: ["calendar_list_events", "calendar_create_event", "calendar_reschedule", "calendar_cancel_event"],
    needs: ["google_calendar", "outlook_calendar"],
    needsLabel: "Google Calendar",
  },
  {
    id: "money",
    label: "Look at your spending",
    hint: "Adds up statements you upload.",
    tools: ["review_spending"],
  },
  {
    id: "tasks",
    label: "Keep your to-do list",
    hint: "Reads and adds tasks.",
    tools: ["tasks_read", "tasks_write"],
    needs: ["google_tasks", "microsoft_todo"],
    needsLabel: "Google Tasks",
  },
  {
    id: "slack",
    label: "Use Slack",
    hint: "Reads and posts messages.",
    tools: ["slack_read", "slack_post_message"],
    needs: ["slack"],
    needsLabel: "Slack",
  },
  {
    id: "github",
    label: "Use GitHub",
    hint: "Reads issues and code, and proposes changes.",
    tools: ["github_read", "github_write"],
    needs: ["github"],
    needsLabel: "GitHub",
  },
  {
    id: "social",
    label: "Post to social media",
    hint: "Writes posts. You approve each one.",
    tools: ["social_read", "social_manage", "publish_post"],
    needs: ["linkedin", "meta", "x", "threads"],
    needsLabel: "a social account",
  },
  {
    id: "phone",
    label: "Text and call",
    hint: "Sends texts. You approve each one.",
    tools: ["phone_read", "phone_send"],
    needs: ["phone"],
    needsLabel: "a phone number",
  },
];

/** Always on: nothing here leaves Desker without you. */
export const CORE_TOOLS: readonly WorkToolId[] = [
  "search_documents",
  "draft_content",
  "life_record",
  "schedule_followup",
  "suggest_opportunity",
  "escalate_to_human",
  "delegate_to_colleague",
];

/** What a new assistant starts with: only the abilities that need no connected app. */
export function defaultAbilities(): Set<string> {
  return new Set(ABILITIES.filter((ability) => !ability.needs).map((ability) => ability.id));
}

/** The abilities a stored tool list switches on. Null (every tool) means all of them. */
export function enabledAbilities(tools: readonly string[] | null): Set<string> {
  if (!tools) return new Set(ABILITIES.map((ability) => ability.id));
  const have = new Set(tools);
  return new Set(ABILITIES.filter((ability) => ability.tools.some((tool) => have.has(tool))).map((ability) => ability.id));
}

/** The tool list to store for a set of switched-on abilities. */
export function toolsFor(enabled: ReadonlySet<string>): WorkToolId[] {
  return [...new Set([...CORE_TOOLS, ...ABILITIES.filter((ability) => enabled.has(ability.id)).flatMap((ability) => ability.tools)])];
}
