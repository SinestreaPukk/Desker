/**
 * The fixed agent tool set.
 *
 * Deliberately closed. Everything else an assistant does is a work tool
 * (lib/work/tools.ts); this is the one chat tool.
 */
import type { ToolDefinition } from "@/lib/llm/provider";
import { SEARCH_DOCUMENTS_TOOL } from "@/lib/rag/search-documents-tool";

export const TOOL_IDS = ["search_documents"] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** UI-facing copy for the builder's permission checkboxes. */
export const TOOL_METADATA: Record<
  ToolId,
  { label: string; blurb: string; icon: "search" }
> = {
  search_documents: {
    label: "Search uploaded documents",
    blurb:
      "Look up passages in the documents you have uploaded for this agent. What you told Desker about yourself is always in its instructions, so it never needs this for that.",
    icon: "search",
  },
};

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  search_documents: SEARCH_DOCUMENTS_TOOL,
};

/** Resolves the stored `allowedTools` list into definitions for the model. */
export function toolDefinitionsFor(allowedTools: string[]): ToolDefinition[] {
  return allowedTools.filter(isToolId).map((id) => TOOL_DEFINITIONS[id]);
}
