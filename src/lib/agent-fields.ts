/**
 * Prisma `Json` columns come back as `Prisma.JsonValue`. These helpers narrow
 * the two list-shaped agent fields to `string[]` without scattering casts.
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Normalises free-text list input (one item per line) into a clean array. */
export function parseLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}
