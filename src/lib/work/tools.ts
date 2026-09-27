/**
 * The fixed tool set for autonomous work.
 *
 * Small and closed on purpose: an agent gets research, drafting, two ways to
 * reach the outside world, a way to queue its own next task, and the
 * documents it was given. No code execution, no arbitrary HTTP.
 *
 * Every tool declares a risk level, and that level - not the tool's name - is
 * what the runner gates on. `external` tools stop for a human unless the
 * agent has been moved to auto mode.
 */
import type { ToolDefinition } from "@/lib/llm/provider";
import { SEARCH_DOCUMENTS_TOOL } from "@/lib/rag/search-documents-tool";
import { DRAFT_KINDS, GATED_TOOL_IDS } from "./types";

export const WORK_TOOL_IDS = [
  "search_documents",
  "web_research",
  "draft_content",
  "publish_post",
  "send_email",
  "calendar_list_events",
  "calendar_create_event",
  "slack_post_message",
  "github_read",
  "schedule_followup",
  "delegate_to_colleague",
  "suggest_opportunity",
  "escalate_to_human",
] as const;
export type WorkToolId = (typeof WORK_TOOL_IDS)[number];

export function isWorkToolId(value: string): value is WorkToolId {
  return (WORK_TOOL_IDS as readonly string[]).includes(value);
}

/** A scope's stored allowlist, dropping anything that is no longer a tool. Null = every tool. */
export function scopeTools(value: unknown): WorkToolId[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is WorkToolId => typeof entry === "string" && isWorkToolId(entry));
}

/**
 * read: touches nothing. draft: writes only inside this product.
 * internal: changes what the agent will do next. external: leaves the building.
 */
type RiskLevel = "read" | "draft" | "internal" | "external";

export const WORK_TOOL_RISK: Record<WorkToolId, RiskLevel> = {
  search_documents: "read",
  web_research: "read",
  draft_content: "draft",
  suggest_opportunity: "draft",
  schedule_followup: "internal",
  delegate_to_colleague: "internal",
  escalate_to_human: "internal",
  publish_post: "external",
  send_email: "external",
  calendar_list_events: "read",
  github_read: "read",
  calendar_create_event: "external",
  slack_post_message: "external",
};

/** The tools a person can move to auto mode independently of the agent. */
export const GATED_TOOLS = GATED_TOOL_IDS satisfies readonly WorkToolId[];

export const WORK_TOOL_METADATA: Record<WorkToolId, { label: string; blurb: string }> = {
  search_documents: {
    label: "Search uploaded documents",
    blurb: "Look things up in the documents uploaded to this agent. Company Context is always in its instructions.",
  },
  web_research: {
    label: "Research the web",
    blurb: "Search, read the top results, and write up findings with sources.",
  },
  draft_content: {
    label: "Draft content",
    blurb: "Write a blog post, social caption or email into a draft. Never publishes.",
  },
  publish_post: {
    label: "Publish a post",
    blurb: "Send a draft to the connected publishing webhook. Waits for your approval unless you allow it to go on its own.",
  },
  send_email: {
    label: "Send an email",
    blurb: "Send a draft or a message through the connected email provider. Waits for your approval unless you allow it to go on its own.",
  },
  calendar_list_events: {
    label: "Check the calendar",
    blurb: "See events on the connected Google Calendar. Needs Google Calendar connected.",
  },
  calendar_create_event: {
    label: "Add calendar events",
    blurb: "Put a meeting on the connected calendar. Waits for your approval unless you allow it to go on its own.",
  },
  slack_post_message: {
    label: "Post to Slack",
    blurb: "Post a message to a Slack channel the app is in. Waits for your approval unless you allow it to go on its own.",
  },
  github_read: {
    label: "Read GitHub",
    blurb: "Read code, issues and pull requests in the repositories you shared. Never writes.",
  },
  schedule_followup: {
    label: "Schedule a follow-up",
    blurb: "Queue the next task this one depends on, now or later.",
  },
  delegate_to_colleague: {
    label: "Delegate to colleague",
    blurb: "Hand off a task or findings to a specialized teammate on your roster.",
  },
  suggest_opportunity: {
    label: "Suggest opportunity or alert",
    blurb: "Proactively post a news alert, market trend, bug, or idea to the team inbox.",
  },
  escalate_to_human: {
    label: "Escalate to a human",
    blurb: "Flag this task for a person when the escalation rule applies or the work cannot be done safely.",
  },
};

const WORK_TOOLS: Record<Exclude<WorkToolId, "escalate_to_human">, ToolDefinition> = {
  search_documents: SEARCH_DOCUMENTS_TOOL,
  web_research: {
    name: "web_research",
    description:
      "Research a topic on the public web: runs a search, reads the most relevant pages, and returns findings with sources. Findings are saved to this task's results automatically. Use specific queries; call it more than once for different angles.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
        focus: {
          type: "string",
          description: "What the findings should concentrate on, e.g. 'pricing changes announced this month'.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  draft_content: {
    name: "draft_content",
    description:
      "Save a piece of written content as a draft for a human to review. Never publishes or sends anything. Returns the draft id, which publish_post and send_email accept.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...DRAFT_KINDS], description: "What kind of content this is." },
        title: { type: "string", description: "A short title. For an email, the subject line." },
        body: { type: "string", description: "The full content, in Markdown. For a social caption, plain text." },
        platform: { type: "string", description: "For a social caption: the platform it is written for." },
        to: { type: "string", description: "For an email: the recipient address or addresses, comma-separated." },
      },
      required: ["kind", "title", "body"],
      additionalProperties: false,
    },
  },
  publish_post: {
    name: "publish_post",
    description:
      "Publish a draft through the organisation's connected publishing integration. In draft-only mode this queues the draft for human approval instead and nothing goes out until it is approved. Only usable when a publishing integration is connected.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The id returned by draft_content." },
        note: { type: "string", description: "One line for the approver: what this is and why now." },
      },
      required: ["draft_id"],
      additionalProperties: false,
    },
  },
  send_email: {
    name: "send_email",
    description:
      "Send an email through the organisation's connected email provider. In draft-only mode this queues the email for human approval instead and nothing is sent until it is approved. Provide either a draft_id of kind 'email', or to/subject/body directly.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "An email draft's id from draft_content." },
        to: { type: "string", description: "Recipient address or addresses, comma-separated." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text or Markdown." },
        note: { type: "string", description: "One line for the approver: what this is and why now." },
      },
      additionalProperties: false,
    },
  },
  calendar_list_events: {
    name: "calendar_list_events",
    description:
      "List events on the organisation's connected Google Calendar between two times. Use it before proposing a meeting, to find free slots. Only usable when Google Calendar is connected.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start of the window, ISO 8601 with a time zone offset." },
        to: { type: "string", description: "End of the window, ISO 8601 with a time zone offset. At most 31 days after from." },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  calendar_create_event: {
    name: "calendar_create_event",
    description:
      "Add an event to the connected Google Calendar, inviting the attendees. In draft-only mode this queues the event for human approval and nothing is created until it is approved. Check the calendar first so it does not clash.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "The event title." },
        start: { type: "string", description: "Start, ISO 8601 with a time zone offset." },
        end: { type: "string", description: "End, ISO 8601 with a time zone offset." },
        attendees: { type: "string", description: "Attendee email addresses, comma-separated. Optional." },
        description: { type: "string", description: "Agenda or notes. Optional." },
        note: { type: "string", description: "One line for the approver: what this is and why now." },
      },
      required: ["summary", "start", "end"],
      additionalProperties: false,
    },
  },
  slack_post_message: {
    name: "slack_post_message",
    description:
      "Post a message to a Slack channel through the connected Slack workspace. In draft-only mode this queues the message for human approval and nothing is posted until it is approved. The Desker app can only post in channels it has been invited to.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: 'The channel, as "#name" or a channel id.' },
        text: { type: "string", description: "The message, in Slack's plain-text formatting." },
        note: { type: "string", description: "One line for the approver: what this is and why now." },
      },
      required: ["channel", "text"],
      additionalProperties: false,
    },
  },
  github_read: {
    name: "github_read",
    description:
      "Read from the GitHub repositories the organisation shared with Desker. Read-only: it cannot push, comment or change anything. Actions: list_repos (what is shared), list_issues (open issues and PRs in a repo), get_issue (one issue or PR with its comments), read_file (a file, or a directory listing), search_code (find files mentioning something).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list_repos", "list_issues", "get_issue", "read_file", "search_code"],
        },
        repo: { type: "string", description: 'The repository as "owner/name". Not needed for list_repos.' },
        number: { type: "integer", description: "For get_issue: the issue or PR number." },
        path: { type: "string", description: "For read_file: the path inside the repo; empty for the root listing." },
        query: { type: "string", description: "For search_code: what to search for." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  schedule_followup: {
    name: "schedule_followup",
    description:
      "Queue the next piece of work as its own task, to run now or after a delay. Use it when this task's result should feed a later step - research now, draft tomorrow. The follow-up gets this task's summary as context.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", description: "What the follow-up task should achieve, specifically." },
        delay_minutes: {
          type: "integer",
          description: "How long to wait before it starts. 0 runs it immediately. Maximum 43200 (30 days).",
        },
      },
      required: ["objective"],
      additionalProperties: false,
    },
  },
  delegate_to_colleague: {
    name: "delegate_to_colleague",
    description:
      "Delegate a sub-task or related work item to another agent on your team roster. Use when a task matches a colleague's role (e.g. asking the Researcher for deep competitor intelligence, the Marketer to draft an announcement, or the Programmer to diagnose or fix a bug). The colleague will run their own autonomous task with the instructions and findings you provide.",
    inputSchema: {
      type: "object",
      properties: {
        colleague_id: {
          type: "string",
          description: "The agent id of the colleague to delegate to, from your team roster.",
        },
        task: {
          type: "string",
          description: "Clear, specific objective and instructions for what the colleague should accomplish.",
        },
        context_findings: {
          type: "string",
          description: "Any relevant data, findings, snippets, or background context your colleague needs to complete the work.",
        },
      },
      required: ["colleague_id", "task"],
      additionalProperties: false,
    },
  },
  suggest_opportunity: {
    name: "suggest_opportunity",
    description:
      "Proactively raise an opportunity, breaking news event, market shift, or bug to the team inbox. Use this whenever you discover something noteworthy during your work (e.g. competitor pricing change, breaking industry news, an opportunity to improve the product, or a bug that needs fixing).",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, crisp headline of what was discovered (under 120 characters).",
        },
        type: {
          type: "string",
          enum: ["opportunity", "news", "bug", "suggestion"],
          description: "The nature of the item being raised.",
        },
        what_happened: {
          type: "string",
          description: "Specific details of what you observed, discovered, or reproduced.",
        },
        why_it_matters: {
          type: "string",
          description: "Strategic impact, importance, or risk for the company.",
        },
        recommended_action: {
          type: "string",
          description: "Concrete recommended next step or proposal for the team to take.",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Urgency level, especially for bugs or critical market alerts.",
        },
      },
      required: ["title", "type", "what_happened", "why_it_matters", "recommended_action"],
      additionalProperties: false,
    },
  },
};

const ESCALATE_TOOL: ToolDefinition = {
  name: "escalate_to_human",
  description:
    "Flag this task for a person. Call it when the escalation rule applies, when you cannot complete an objective safely or reliably (no trustworthy sources, an action that would reach more people than seems right, an instruction you do not understand), or when a decision is not yours to make. The task continues afterwards; write what you found and what the person should decide in your report.",
  inputSchema: {
    type: "object",
    properties: {
      reason: { type: "string", description: "One or two sentences: what happened and why a person is needed." },
      summary: { type: "string", description: "A short headline for the inbox, under 80 characters." },
    },
    required: ["reason", "summary"],
    additionalProperties: false,
  },
};

export function workToolDefinitions(ids: readonly WorkToolId[]): ToolDefinition[] {
  return ids.map((id) => (id === "escalate_to_human" ? ESCALATE_TOOL : WORK_TOOLS[id]));
}
