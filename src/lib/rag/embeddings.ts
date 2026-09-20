/**
 * Embedding backends.
 *
 * Anthropic does not serve an embeddings endpoint, so a Claude-only deployment
 * needs a local option or RAG would be gated behind a second vendor's key. Both
 * backends emit the same 1536 dimensions as the pgvector column.
 *
 *   openai -> text-embedding-3-small. Real semantic similarity.
 *   local  -> deterministic feature hashing over word unigrams + bigrams.
 *             No network, no key, no model download. It captures lexical
 *             overlap rather than meaning, which is why retrieval fuses it with
 *             a BM25 keyword score instead of relying on cosine alone.
 */
import "server-only";
import { env } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 1536;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

/** FNV-1a, used as the hashing function for the local embedder. */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

export function localEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vector;

  const features = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    features.push(`${tokens[i]}_${tokens[i + 1]}`);
  }

  for (const feature of features) {
    const h = hash(feature);
    const index = h % EMBEDDING_DIMENSIONS;
    // Sign bit spreads features across the space instead of only adding.
    const sign = (h >>> 31) & 1 ? -1 : 1;
    vector[index]! += sign;
  }

  return l2Normalize(vector);
}

export function l2Normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const magnitude = Math.sqrt(sum);
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < length; i++) dot += a[i]! * b[i]!;
  return dot;
}

async function openAiEmbed(texts: string[]): Promise<number[][]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  // The API preserves input order, but sort by index rather than trust it.
  return [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

/** Batched so a large document is one or two API calls, not one per chunk. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (env.embeddingProvider === "openai" && env.hasOpenAiKey) {
    const BATCH = 96;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      out.push(...(await openAiEmbed(texts.slice(i, i + BATCH))));
    }
    return out;
  }

  return texts.map(localEmbed);
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector ?? localEmbed(text);
}

/** Which backend a given deployment will actually use, for display in the UI. */
export function activeEmbeddingBackend(): "openai" | "local" {
  return env.embeddingProvider === "openai" && env.hasOpenAiKey ? "openai" : "local";
}
