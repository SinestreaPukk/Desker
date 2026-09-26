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

/**
 * Hex mirrors of design tokens, for the few places that cannot read a CSS
 * variable: the browser's theme-color and the generated social card.
 * Keyed by token name, `@dark` for the dark theme's value.
 * scripts/check-contrast.mjs fails if one drifts from globals.css.
 */
export const TOKEN_HEX = {
  paper: "#F9FAFC",
  "paper@dark": "#18191B",
  ink: "#1C2024",
  "ink-muted": "#60646C",
  "ink-subtle": "#80838D",
  "accent-soft": "#F0F1FE",
} as const;
