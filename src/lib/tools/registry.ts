/**
 * The fixed agent tool set.
 *
 * Deliberately closed. Letting admins define arbitrary tools is a different
 * product; these four are what an AI employee needs to be useful and
 * accountable: look things up, record a problem, record an idea, hand off.
 */
import type { ToolDefinition } from "@/lib/llm/provider";

export const TOOL_IDS = [
  "search_company_context",
  "log_issue",
  "log_suggestion",
  "escalate_to_human",
  "transfer_to_agent",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** UI-facing copy for the builder's permission checkboxes. */
export const TOOL_METADATA: Record<
  ToolId,
  {
    label: string;
    blurb: string;
    icon: "search" | "bug" | "lightbulb" | "handoff" | "transfer";
  }
> = {
  search_company_context: {
    label: "Search company context",
    blurb:
      "Look up answers in the documents you have uploaded for this agent. Turn this off and the agent can only rely on its persona.",
    icon: "search",
  },
  log_issue: {
    label: "Log an issue",
    blurb:
      "Record a bug or problem the client reports, with a severity, so it lands in your issue inbox.",
    icon: "bug",
  },
  log_suggestion: {
    label: "Log a suggestion",
    blurb: "Record a feature request or idea the client raises.",
    icon: "lightbulb",
  },
  escalate_to_human: {
    label: "Escalate to a human",
    blurb:
      "Flag the conversation for your attention. This is what your escalation rule triggers.",
    icon: "handoff",
  },
  transfer_to_agent: {
    label: "Transfer to a colleague",
    blurb:
      "Hand the conversation to another published agent. Turn this on for a receptionist that routes clients to the right specialist.",
    icon: "transfer",
  },
};

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  search_company_context: {
    name: "search_company_context",
    description:
      "Search the company and client documents that have been provided to you for this role. " +
      "Use this before answering any question about products, policies, pricing, procedures, or " +
      "anything else specific to the company - do not answer from memory. Returns the most " +
      "relevant excerpts with their source filenames. Call it more than once with different " +
      "phrasings if the first search does not return what you need.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query. Use the client's own wording plus any obvious synonyms.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },

  log_issue: {
    name: "log_issue",
    description:
      "Record a bug, defect, or problem the client has reported so a human on the team can act " +
      "on it. Call this as soon as the client describes something that is broken or not working " +
      "as expected - do not wait until the end of the conversation, and do not promise to log " +
      "something without actually calling this tool.",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One line describing the problem, written for a colleague to triage.",
        },
        severity: {
          type: "string",
          enum: [...SEVERITIES],
          description:
            "low: cosmetic or minor annoyance. medium: a feature works badly or needs a " +
            "workaround. high: a core workflow is blocked for this client. critical: data " +
            "loss, a security concern, or an outage affecting many users.",
        },
        details: {
          type: "string",
          description:
            "What the client did, what they expected, and what actually happened. Include any " +
            "error messages, order numbers, or identifiers they gave you.",
        },
      },
      required: ["summary", "severity", "details"],
      additionalProperties: false,
    },
  },

  log_suggestion: {
    name: "log_suggestion",
    description:
      "Record a feature request, improvement idea, or piece of product feedback the client has " +
      "raised, so the team can review it. Use this for 'it would be nice if...' input, as " +
      "opposed to something being broken, which belongs in log_issue.",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One line describing the suggestion.",
        },
        details: {
          type: "string",
          description:
            "The client's reasoning: what they are trying to accomplish and why the current " +
            "behaviour gets in the way.",
        },
      },
      required: ["summary", "details"],
      additionalProperties: false,
    },
  },

  transfer_to_agent: {
    name: "transfer_to_agent",
    description:
      "Hand this conversation to a colleague who covers the topic better than you do. " +
      "The client keeps the same chat window and everything said so far travels with them, " +
      "so do not ask them to repeat anything. Use this when the request is squarely " +
      "another role's work - not merely when it is hard. If nobody on the list fits, " +
      "escalate to a human instead. Never transfer more than once for the same request.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description:
            "The id of the colleague to transfer to, exactly as given in your list of colleagues.",
        },
        reason: {
          type: "string",
          description:
            "What the client needs and what you have already established, written for the colleague picking it up cold.",
        },
      },
      required: ["agent_id", "reason"],
      additionalProperties: false,
    },
  },

  escalate_to_human: {
    name: "escalate_to_human",
    description:
      "Hand this conversation to a human colleague and flag it for immediate attention. Call " +
      "this when your escalation rule is met, when the client explicitly asks for a human, or " +
      "when you are being asked to do something outside your role or authority. After calling " +
      "it, tell the client plainly that you have passed it to a colleague - never imply that a " +
      "human is already reading.",
    inputSchema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Why this needs a human, and the context they need to pick it up cold.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
};

/** Resolves the stored `allowedTools` list into definitions for the model. */
export function toolDefinitionsFor(allowedTools: string[]): ToolDefinition[] {
  return allowedTools.filter(isToolId).map((id) => TOOL_DEFINITIONS[id]);
}
