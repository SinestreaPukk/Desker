/**
 * Hybrid retrieval over one agent's uploaded context documents.
 *
 * Two interchangeable backends behind one function:
 *   postgresql -> pgvector ANN for the vector half, tsvector/ts_rank for the
 *                 keyword half. Scales past what fits in process memory.
 *   sqlite     -> the same two halves computed in process (cosine + BM25).
 *
 * Both fuse the two rankings with reciprocal rank fusion. Vector-only retrieval
 * misses exact identifiers (SKUs, error codes, policy numbers); keyword-only
 * retrieval misses paraphrase. The fusion is what makes this useful rather than
 * a demo.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { usesPgVector } from "@/lib/env";
import { bm25Rank, reciprocalRankFusion } from "./bm25";
import { cosineSimilarity, embedOne } from "./embeddings";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export const DEFAULT_TOP_K = 5;
/** How many candidates each half contributes before fusion. */
const CANDIDATE_POOL = 24;

/**
 * Relevance floor for a vector-only hit.
 *
 * Nearest-neighbour search always returns something - ask an unrelated question
 * and it hands back the least-unrelated chunk, which the model then treats as
 * an answer. So a chunk earns a place in the results only if it either matched
 * on keywords or cleared this cosine similarity.
 *
 * 0.30 is calibrated for a real semantic embedder (text-embedding-3-small).
 * The `local` hashed embedder scores related text between roughly 0.03 and 0.28
 * and unrelated text between -0.03 and 0.05 - the two ranges overlap, so no
 * threshold separates them. That is deliberate: under `local`, relevance is
 * decided by the keyword half and the vector half only breaks ties. It is also
 * the concrete reason to set EMBEDDING_PROVIDER=openai for paraphrase recall.
 */
export const MIN_VECTOR_SIMILARITY = 0.3;

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function retrievePostgres(
  agentId: string,
  query: string,
  topK: number,
): Promise<RetrievedChunk[]> {
  const embedding = toVectorLiteral(await embedOne(query));

  const [vectorHits, keywordHits] = await Promise.all([
    // `<=>` is cosine distance, so similarity is 1 - distance. The floor keeps
    // an unrelated question from being answered with the nearest paragraph.
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "DocumentChunk"
      WHERE "agentId" = ${agentId}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embedding}::vector) >= ${MIN_VECTOR_SIMILARITY}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${CANDIDATE_POOL}
    `,
    // `plainto_tsquery` joins its lexemes with AND, so a single word the corpus
    // does not contain ("how long do I have to return something") drops the
    // whole keyword half. Rewriting the operator to OR restores the ranked
    // partial matching that BM25 gives the in-process backend, which is what
    // the fusion below is designed around. Rewriting the normalised query's
    // text is safe - the untrusted value has already been parameterised and
    // lexed by plainto_tsquery before the replace runs.
    prisma.$queryRaw<{ id: string }[]>`
      WITH q AS (
        SELECT NULLIF(
          replace(plainto_tsquery('english', ${query})::text, '&', '|'),
          ''
        )::tsquery AS tsq
      )
      SELECT id
      FROM "DocumentChunk", q
      WHERE "agentId" = ${agentId}
        AND q.tsq IS NOT NULL
        AND to_tsvector('english', content) @@ q.tsq
      ORDER BY ts_rank(to_tsvector('english', content), q.tsq) DESC
      LIMIT ${CANDIDATE_POOL}
    `,
  ]);

  return hydrate(reciprocalRankFusion([vectorHits, keywordHits]), topK);
}

async function retrieveInProcess(
  agentId: string,
  query: string,
  topK: number,
): Promise<RetrievedChunk[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: { agentId },
    select: { id: true, content: true, embeddingJson: true },
  });
  if (chunks.length === 0) return [];

  const queryVector = await embedOne(query);

  const keywordRanking = bm25Rank(query, chunks).slice(0, CANDIDATE_POOL);
  const keywordMatched = new Set(keywordRanking.map((hit) => hit.id));

  const vectorRanking = chunks
    .map((chunk) => {
      if (!chunk.embeddingJson) return { id: chunk.id, score: 0 };
      const vector = JSON.parse(chunk.embeddingJson) as number[];
      return { id: chunk.id, score: cosineSimilarity(queryVector, vector) };
    })
    // A vector-only hit must clear the floor; a chunk the keyword half already
    // found keeps its vector rank so fusion can still reorder it.
    .filter(
      (hit) => hit.score >= MIN_VECTOR_SIMILARITY || keywordMatched.has(hit.id),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL);

  return hydrate(reciprocalRankFusion([vectorRanking, keywordRanking]), topK);
}

/** Turns fused ids back into displayable chunks, preserving fusion order. */
async function hydrate(
  fused: Map<string, number>,
  topK: number,
): Promise<RetrievedChunk[]> {
  const ordered = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);
  if (ordered.length === 0) return [];

  const rows = await prisma.documentChunk.findMany({
    where: { id: { in: ordered.map(([id]) => id) } },
    select: {
      id: true,
      documentId: true,
      chunkIndex: true,
      content: true,
      document: { select: { filename: true } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ordered.flatMap(([id, score]) => {
    const row = byId.get(id);
    if (!row) return [];
    return [
      {
        id: row.id,
        documentId: row.documentId,
        filename: row.document.filename,
        chunkIndex: row.chunkIndex,
        content: row.content,
        score,
      },
    ];
  });
}

export async function retrieveContext(
  agentId: string,
  query: string,
  topK: number = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  return usesPgVector
    ? retrievePostgres(agentId, query, topK)
    : retrieveInProcess(agentId, query, topK);
}

/**
 * Writes the pgvector mirror of `embeddingJson`. Prisma Client cannot write an
 * `Unsupported` column, so this is the one place raw SQL is required.
 */
export async function syncVectorColumn(
  chunkId: string,
  embedding: number[],
): Promise<void> {
  if (!usesPgVector) return;
  await prisma.$executeRaw(
    Prisma.sql`UPDATE "DocumentChunk" SET embedding = ${toVectorLiteral(embedding)}::vector WHERE id = ${chunkId}`,
  );
}
