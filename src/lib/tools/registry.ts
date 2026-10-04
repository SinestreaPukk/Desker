/**
 * The fixed agent tool set.
 * Deliberately closed. Everything else an assistant does is a work tool (lib/work/tools.ts).
 */
import type { ToolDefinition } from "@/lib/llm/provider";
import { SEARCH_DOCUMENTS_TOOL } from "@/lib/rag/search-documents-tool";
import {
  REMEMBER_TOOL,
  FORGET_TOOL,
  RECALL_TOOL,
  CREATE_COMMITMENT_TOOL,
  UPDATE_COMMITMENT_TOOL,
  LIST_COMMITMENTS_TOOL,
  CLOSE_COMMITMENT_TOOL,
  CAPTURE_ITEM_TOOL,
  UPDATE_TRIGGER_RULE_TOOL,
  LIST_TRIGGER_RULES_TOOL,
} from "./assistant-tools";

export const TOOL_IDS = [
  "search_documents",
  "remember",
  "forget",
  "recall",
  "create_commitment",
  "update_commitment",
  "list_commitments",
  "close_commitment",
  "capture_item",
  "update_trigger_rule",
  "list_trigger_rules",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

/** UI-facing copy for the builder's permission checkboxes. */
export const TOOL_METADATA: Record<
  ToolId,
  { label: string; blurb: string; icon: string }
> = {
  search_documents: {
    label: "Search uploaded documents",
    blurb:
      "Look up passages in the documents you have uploaded for this agent. What you told Desker about yourself is always in its instructions, so it never needs this for that.",
    icon: "search",
  },
  remember: {
    label: "Remember facts and preferences",
    blurb: "Save stated preferences, routines, instructions, and contacts into visible memory.",
    icon: "bookmark",
  },
  forget: {
    label: "Forget facts",
    blurb: "Remove facts from memory upon request.",
    icon: "trash",
  },
  recall: {
    label: "Recall memories by meaning",
    blurb: "Search past memories and preferences by meaning.",
    icon: "search",
  },
  create_commitment: {
    label: "Track commitments",
    blurb: "Create commitments for tasks, waiting-on items, or recurring obligations.",
    icon: "check",
  },
  update_commitment: {
    label: "Update commitments",
    blurb: "Update commitment outcome, deadline, snooze, or add notes.",
    icon: "edit",
  },
  list_commitments: {
    label: "List commitments",
    blurb: "List open loops and commitments.",
    icon: "list",
  },
  close_commitment: {
    label: "Close commitments",
    blurb: "Mark commitments done or dropped.",
    icon: "check-circle",
  },
  capture_item: {
    label: "Capture and intake items",
    blurb: "Process captured items into tasks, events, bills, notes, or files.",
    icon: "inbox",
  },
  update_trigger_rule: {
    label: "Configure proactive triggers",
    blurb: "Adjust briefing times, quiet hours, and notification rules.",
    icon: "bell",
  },
  list_trigger_rules: {
    label: "List trigger rules",
    blurb: "List proactive trigger rules and quiet hours.",
    icon: "sliders",
  },
};

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  search_documents: SEARCH_DOCUMENTS_TOOL,
  remember: REMEMBER_TOOL,
  forget: FORGET_TOOL,
  recall: RECALL_TOOL,
  create_commitment: CREATE_COMMITMENT_TOOL,
  update_commitment: UPDATE_COMMITMENT_TOOL,
  list_commitments: LIST_COMMITMENTS_TOOL,
  close_commitment: CLOSE_COMMITMENT_TOOL,
  capture_item: CAPTURE_ITEM_TOOL,
  update_trigger_rule: UPDATE_TRIGGER_RULE_TOOL,
  list_trigger_rules: LIST_TRIGGER_RULES_TOOL,
};

/** Resolves the stored `allowedTools` list into definitions for the model. */
export function toolDefinitionsFor(allowedTools: string[]): ToolDefinition[] {
  return allowedTools.filter(isToolId).map((id) => TOOL_DEFINITIONS[id]);
}
