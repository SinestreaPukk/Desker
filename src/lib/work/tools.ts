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
import { DRAFT_KINDS } from "./types";

export const WORK_TOOL_IDS = [
  "search_context",
  "web_research",
  "draft_content",
  "publish_post",
  "send_email",
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
export type RiskLevel = "read" | "draft" | "internal" | "external";

export const WORK_TOOL_RISK: Record<WorkToolId, RiskLevel> = {
  search_context: "read",
  web_research: "read",
  draft_content: "draft",
  suggest_opportunity: "draft",
  schedule_followup: "internal",
  delegate_to_colleague: "internal",
  escalate_to_human: "internal",
  publish_post: "external",
  send_email: "external",
};

/** The tools a person can move to auto mode independently of the agent. */
export const GATED_TOOLS = ["publish_post", "send_email"] as const satisfies readonly WorkToolId[];

export const WORK_TOOL_METADATA: Record<WorkToolId, { label: string; blurb: string }> = {
  search_context: {
    label: "Search context documents",
    blurb: "Look things up in the documents linked to the scope of work.",
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
    blurb: "Send a draft to the connected publishing webhook. Waits for approval in draft-only mode.",
  },
  send_email: {
    label: "Send an email",
    blurb: "Send a draft or a message through the connected email provider. Waits for approval in draft-only mode.",
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

export const WORK_TOOLS: Record<Exclude<WorkToolId, "escalate_to_human">, ToolDefinition> = {
  search_context: {
    name: "search_context",
    description:
      "Search the project's context documents for passages relevant to a query. Use it before relying on anything the organisation would know better than the public web: products, positioning, policies, past work.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, as a natural question or keywords." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
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

export const ESCALATE_TOOL: ToolDefinition = {
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
