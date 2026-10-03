/**
 * Single source of truth for the product identity.
 *
 * Renaming the product should mean editing this file and the assets in
 * public/brand, and nothing else - never hardcode the name in components.
 */
export const BRAND = {
  name: "Desker Personal",
  tagline: "Your personal agentic AI",
  /** Used in the assembled system prompt so agents know what platform they run on. */
  platformDescription: "a personal agentic AI assistant",
  /**
   * The brand ink blue. The UI reads it from the `--brand` design token
   * rather than from here; this is the reference value
   * for anything that needs a literal (the widget launcher, the app icon).
   */
  color: "#3558E6",
} as const;

/**
 * Hex mirrors of design tokens, for the few places that cannot read a CSS
 * variable: the browser's theme-color and the generated social card.
 * Keyed by token name.
 * scripts/check-contrast.mjs fails if one drifts from globals.css.
 */
export const TOKEN_HEX = {
  paper: "#F8FAFD",
  ink: "#1E2A45",
  "ink-muted": "#56627A",
  "ink-subtle": "#8390A6",
  "accent-soft": "#C7E6FF",
} as const;
