/** URL-safe, stable, and readable. Shared by projects and organisations. */
export function slugify(name: string, fallback = "item"): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || fallback;
}
