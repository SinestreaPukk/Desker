/**
 * Reading JSON back out of a model reply.
 *
 * The reporting calls (run summaries, digests) ask for a single JSON object
 * and nothing else, and mostly get exactly that - but "mostly" is not a
 * contract. A fenced block, a sentence of preamble, or a trailing "Hope that
 * helps" must not cost an owner their summary, so the text is salvaged rather
 * than trusted, and every caller has a deterministic fallback for when even
 * this fails.
 */

/** The first balanced `{...}` in the text, ignoring braces inside strings. */
function firstObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** The model's reply as an object, or null if nothing usable came back. */
export function parseModelJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  for (const candidate of [withoutFence, firstObject(withoutFence)]) {
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** A trimmed string field, or "" when the model left it out or sent the wrong type. */
export function stringField(source: Record<string, unknown> | null, key: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Cuts to a length without leaving half a word behind. */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/** The first `count` sentences of a block of prose, for a deterministic fallback. */
export function firstSentences(text: string, count: number): string {
  const sentences = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length === 0) return text.replace(/\s+/g, " ").trim();
  // Each match keeps its own trailing space, so join on nothing and trim.
  return sentences.slice(0, count).join("").trim();
}
