/**
 * Document chunking.
 *
 * Deliberately boring: paragraph-aware greedy packing with a character overlap.
 * The overlap matters more than the split strategy - it is what stops an answer
 * that straddles a chunk boundary from being lost.
 *
 * Pure and dependency-free so it can be unit tested directly.
 */

export interface ChunkOptions {
  /** Target chunk size in characters. */
  maxChars?: number;
  /** Characters of the previous chunk repeated at the head of the next. */
  overlapChars?: number;
  /** Chunks shorter than this are merged into their neighbour. */
  minChars?: number;
}

export const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
  maxChars: 1200,
  overlapChars: 150,
  minChars: 80,
};

/** Collapses the whitespace noise that PDF and DOCX extraction leaves behind. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits into paragraphs, further splitting any paragraph that alone exceeds maxChars. */
function splitIntoUnits(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const units: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      units.push(paragraph);
      continue;
    }
    // Sentence-ish split. Keeps the terminator with the sentence.
    const sentences = paragraph.match(/[^.!?\n]+[.!?]+["')\]]*\s*|[^.!?\n]+$/g) ?? [
      paragraph,
    ];
    let buffer = "";
    for (const sentence of sentences) {
      if (buffer && buffer.length + sentence.length > maxChars) {
        units.push(buffer.trim());
        buffer = "";
      }
      // A single sentence longer than maxChars still has to be broken up.
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) {
          units.push(sentence.slice(i, i + maxChars).trim());
        }
        continue;
      }
      buffer += sentence;
    }
    if (buffer.trim()) units.push(buffer.trim());
  }

  return units;
}

export function chunkText(input: string, options: ChunkOptions = {}): string[] {
  const { maxChars, overlapChars, minChars } = {
    ...DEFAULT_CHUNK_OPTIONS,
    ...options,
  };

  const text = normalizeText(input);
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const units = splitIntoUnits(text, maxChars);
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      const tail = overlapChars > 0 ? current.slice(-overlapChars) : "";
      // Resume at a word boundary so the overlap does not start mid-word.
      const boundary = tail.search(/\s/);
      const overlap = boundary >= 0 ? tail.slice(boundary + 1) : tail;
      current = overlap ? `${overlap}\n\n${unit}` : unit;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);

  // Fold a runt trailing chunk back into its predecessor.
  if (chunks.length > 1 && chunks[chunks.length - 1]!.length < minChars) {
    const runt = chunks.pop()!;
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${runt}`;
  }

  return chunks;
}
