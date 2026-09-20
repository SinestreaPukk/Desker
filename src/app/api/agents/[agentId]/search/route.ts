import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { activeEmbeddingBackend } from "@/lib/rag/embeddings";
import { retrieveContext } from "@/lib/rag/retriever";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/**
 * Retrieval inspector. Backs the "Test retrieval" panel in the builder so an
 * admin can confirm a document is actually searchable before publishing -
 * exactly what the agent's search_company_context tool will see.
 */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { agentId } = await params;

    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!query) throw new HttpError(400, "Provide a search query.");

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const results = await retrieveContext(agentId, query, 8);

    return {
      query,
      backend: activeEmbeddingBackend(),
      results: results.map((result) => ({
        id: result.id,
        filename: result.filename,
        chunkIndex: result.chunkIndex,
        content: result.content,
        score: Number(result.score.toFixed(5)),
      })),
    };
  });
}
