/**
 * Single source of truth for the product identity.
 *
 * Renaming the product should mean editing this file and the assets in
 * public/brand, and nothing else - never hardcode the name in components.
 */
export const BRAND = {
  name: "Desker",
  tagline: "Agentic AI Platform",
  /** Used in the assembled system prompt so agents know what platform they run on. */
  platformDescription: "an agentic AI platform",
  /**
   * Brand colour as drawn in the logo artwork. The UI reads it from the
   * `--accent` design token rather than from here; this is the reference value
   * for anything that needs a literal (the widget launcher, the app icon).
   */
  color: "#1800AD",
} as const;
