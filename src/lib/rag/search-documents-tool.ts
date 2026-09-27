import { z } from "zod";
import type { ToolDefinition } from "@/lib/llm/provider";

/**
 * The one way an agent looks something up in the documents uploaded to it -
 * in a client chat and in autonomous work alike.
 *
 * Two tiers of context, two mechanics:
 * - Company Context (the four answers about the business) is not searchable.
 *   It is injected into every agent's instructions on every chat turn and every
 *   run, so a saved answer can never come back as "nothing found".
 * - Uploaded documents are longer reference material where only part is
 *   relevant to any one question, so they are searched here, chunk by chunk.
 *
 * The description says so, because the old tool told agents to search before
 * answering anything about the company - and they did, for facts that were
 * already in their instructions, and came back empty.
 *
 * The definition lives apart from the search itself (search-documents.ts) so
 * the editor can read the tool lists without pulling the database into the
 * browser.
 */
export const SEARCH_DOCUMENTS = "search_documents";

export const SEARCH_DOCUMENTS_TOOL: ToolDefinition = {
  name: SEARCH_DOCUMENTS,
  description:
    "Search the documents that were uploaded to you (the files listed in your instructions) for passages " +
    "relevant to a question: product details, policies, pricing sheets, procedures, past work. " +
    "Do not use it for what the business does, who its customers are, or how to sound - that Company " +
    "Context is already in your instructions, complete, and is not in any document. Returns the most " +
    "relevant excerpts with their source filenames; search again with other wording if the first try misses.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to look for, as a natural question or keywords. Use the asker's own wording plus obvious synonyms.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

export const searchDocumentsInput = z.object({ query: z.string().trim().min(1).max(500) });
