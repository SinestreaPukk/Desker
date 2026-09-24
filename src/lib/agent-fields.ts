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

/**
 * Curated list of friendly, distinct agent names used when creating new agents.
 */
export const RANDOM_AGENT_NAMES = [
  "Bright",
  "Moon",
  "John",
  "Purk",
  "Grace",
  "Vann",
  "Tim",
  "Sunny",
  "Jay",
  "Ken",
  "Haley",
  "Sofia",
  "Beep",
  "Rory",
  "Bryson",
  "Dustin",
  "James",
  "Tom",
  "Kevin",
  "Lindsay",
  "Cindy",
  "Nico",
  "Gebby",
  "Charles",
  "Max",
  "Christopher",
  "Nelly",
  "Patrick",
  "Jane",
] as const;

/** Returns a random name from the curated agent name list. */
export function randomAgentName(): string {
  const index = Math.floor(Math.random() * RANDOM_AGENT_NAMES.length);
  return RANDOM_AGENT_NAMES[index]!;
}
