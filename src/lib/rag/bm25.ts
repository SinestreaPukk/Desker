/**
 * Minimal BM25 over an in-memory chunk set.
 *
 * Pure and dependency-free so it can be unit tested, and so the SQLite path
 * gets the same keyword ranking the Postgres path gets from tsvector.
 */
import { tokenize } from "./embeddings";

const K1 = 1.5;
const B = 0.75;

/**
 * English stopwords, mirroring the set Postgres\'s `english` text-search
 * configuration strips inside `plainto_tsquery`.
 *
 * Without this the in-process ranker and the Postgres ranker disagree: a query
 * like "capital city of France" matches any chunk containing "of", which on a
 * small corpus is enough to clear the relevance floor and hand the model an
 * unrelated passage.
 */
const STOPWORDS = new Set([
  // Two-letter function words. These survive tokenisation (which only drops
  // single characters) and are common enough that one of them matching is
  // enough to pull an unrelated chunk over the relevance floor.
  "of", "in", "to", "is", "it", "be", "as", "at", "by", "on", "or", "an",
  "if", "do", "we", "he", "so", "no", "up", "my", "me", "us", "am", "are",
  // Three letters and longer.
  "the", "and", "for", "but", "not", "you", "all", "any", "can", "her",
  "was", "one", "our", "out", "get", "has", "him", "his", "how", "its",
  "let", "put", "say", "she", "too", "use", "that", "with", "have", "this",
  "will", "your", "from", "they", "been", "some", "very", "when", "here",
  "just", "like", "many", "over", "such", "than", "them", "well", "were",
  "what", "would", "there", "their", "which", "about", "into", "only",
  "other", "could", "should", "does", "each", "more", "most", "then",
  "these", "those", "being", "doing", "having", "where", "while", "after",
  "before", "between", "under", "again", "further", "once", "both", "same",
  "also", "because", "until", "during", "above", "below", "through",
  "against", "own", "off", "why", "yes", "yet", "hers", "ours", "yours",
  "theirs", "did", "may", "must", "shall", "were", "who", "whom",
]);

/** Query and document terms that carry no discriminating signal. */
function contentTerms(text: string): string[] {
  return tokenize(text).filter((term) => !STOPWORDS.has(term));
}

interface Bm25Doc {
  id: string;
  content: string;
}

export function bm25Rank(query: string, docs: Bm25Doc[]): { id: string; score: number }[] {
  const queryTerms = [...new Set(contentTerms(query))];
  if (queryTerms.length === 0 || docs.length === 0) return [];

  let totalLength = 0;
  const tokenized = docs.map((doc) => {
    const terms = contentTerms(doc.content);
    totalLength += terms.length;
    const counts = new Map<string, number>();
    for (const term of terms) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    return { id: doc.id, termsLength: terms.length, counts };
  });

  const avgLength = totalLength / tokenized.length || 1;

  // Document frequency per query term: O(1) map check per document.
  const docFreq = new Map<string, number>();
  for (const term of queryTerms) {
    let count = 0;
    for (const doc of tokenized) {
      if (doc.counts.has(term)) count++;
    }
    docFreq.set(term, count);
  }

  const scored = tokenized.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const freq = doc.counts.get(term) ?? 0;
      if (freq === 0) continue;
      const n = docFreq.get(term) ?? 0;
      // BM25+ style idf; never negative, so a term in every doc contributes ~0.
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      const norm = freq * (K1 + 1);
      const denom = freq + K1 * (1 - B + (B * doc.termsLength) / avgLength);
      score += idf * (norm / denom);
    }
    return { id: doc.id, score };
  });

  return scored.filter((doc) => doc.score > 0).sort((a, b) => b.score - a.score);
}

/**
 * Reciprocal rank fusion. Combines rankings from different scoring systems
 * without having to make their raw scores comparable.
 */
export function reciprocalRankFusion(
  rankings: { id: string }[][],
  k = 60,
): Map<string, number> {
  const fused = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((item, index) => {
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return fused;
}
