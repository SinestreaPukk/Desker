import "server-only";
import { prisma } from "@/lib/db";
import { retrieveContext } from "./retriever";

/**
 * Runs `search_documents` (defined in search-documents-tool.ts) and records it, hit or miss: the misses are the useful half,
 * because they are the questions the documents cannot answer (Insights shows them).
 */
export async function searchDocuments(input: {
  agentId: string;
  query: string;
  conversationId?: string | null;
  /** A scope of work may limit a run to some of the agent's documents. */
  documentIds?: readonly string[];
  topK?: number;
}): Promise<{ content: string; hits: number }> {
  const found = await retrieveContext(input.agentId, input.query, input.topK);
  const hits = input.documentIds?.length
    ? found.filter((hit) => input.documentIds!.includes(hit.documentId))
    : found;

  await prisma.retrievalLog
    .create({
      data: {
        agentId: input.agentId,
        conversationId: input.conversationId ?? null,
        query: input.query,
        hitCount: hits.length,
      },
    })
    .catch((error: unknown) => console.error("[search_documents] retrieval log failed", error));

  if (hits.length === 0) {
    return {
      content:
        "No passage in your uploaded documents matches that query. Try other wording; if the documents " +
        "do not cover it, say you do not have that information rather than guessing. (What they told you about themselves is " +
        "already in your instructions and is never in the documents.)",
      hits: 0,
    };
  }
  return {
    content: `${hits.length} relevant passage(s):\n\n${hits
      .map((hit, index) => `[${index + 1}] source: ${hit.filename} (chunk ${hit.chunkIndex + 1})\n${hit.content}`)
      .join("\n\n---\n\n")}`,
    hits: hits.length,
  };
}
