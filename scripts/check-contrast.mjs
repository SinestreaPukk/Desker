#!/usr/bin/env node
/**
 * WCAG contrast audit of the design tokens in src/app/globals.css.
 *
 * Parses the oklch() values out of the :root and :root.dark blocks, converts
 * them to sRGB, and checks the foreground/background pairs the UI actually
 * uses. Run with `node scripts/check-contrast.mjs`; exits non-zero on a failure
 * so it can gate CI.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- colour maths ----------------------------------------------------------

function oklchToSrgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return lin.map((v) => Math.min(1, Math.max(0, v)));
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// --- token extraction ------------------------------------------------------

const css = readFileSync(join(root, "src", "app", "globals.css"), "utf8");

function tokensFrom(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector ${selector} not found in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const block = css.slice(open, close);

  const tokens = {};
  const pattern = /--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g;
  let match;
  while ((match = pattern.exec(block))) {
    tokens[match[1]] = oklchToSrgb(
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    );
  }
  return tokens;
}

// Dark redefines a subset; anything it leaves alone (the landing stage) is
// inherited from :root, so the dark table is layered on the light one.
const light = tokensFrom(":root");
const themes = { light, dark: { ...light, ...tokensFrom(":root.dark") } };

// --- the pairs the UI actually renders -------------------------------------

const TEXT_PAIRS = [
  ["ink", "paper", 4.5, "body text on the page"],
  ["ink", "surface", 4.5, "body text on a card"],
  ["ink", "surface-2", 4.5, "body text on a raised panel"],
  ["ink-muted", "paper", 4.5, "secondary text on the page"],
  ["ink-muted", "surface", 4.5, "secondary text on a card"],
  ["ink-subtle", "paper", 3.0, "metadata (uppercase mono, treated as non-essential)"],
  ["accent-fg", "accent", 4.5, "primary button label"],
  ["accent-soft-fg", "accent-soft", 4.5, "accent badge"],
  ["positive", "positive-soft", 4.5, "published badge"],
  ["warning", "warning-soft", 4.5, "draft / medium badge"],
  ["danger", "danger-soft", 4.5, "error text and critical badge"],
  ["danger", "paper", 4.5, "inline error message"],
  ["accent", "paper", 4.5, "accent link on the page"],
  ["accent", "surface", 4.5, "accent link on a card"],
  // The landing page's sky, the same in both themes. White copy sits only
  // over the deep band of the gradient.
  ["sky-ink", "sky-deep", 4.5, "hero headline, sub-line and note on the deep sky"],
  ["sky-glass-fg", "sky-glass", 4.5, "glass button label"],
];

// Avatar figure against its own tile. Decorative (the agent's name is always
// rendered as text alongside), but a silhouette nobody can make out is a
// pointless one, so they are held to the 3:1 non-text threshold.
for (let i = 1; i <= 6; i++) {
  TEXT_PAIRS.push([`av-${i}-fg`, `av-${i}-bg`, 3.0, `agent avatar tone ${i}`]);
}

// Non-text: borders and focus rings need 3:1 against what they sit on.
const UI_PAIRS = [
  ["line-strong", "surface", 3.0, "input border"],
  ["focus", "paper", 3.0, "focus ring on the page"],
  ["focus", "surface", 3.0, "focus ring on a card"],
];

let failures = 0;
for (const [theme, tokens] of Object.entries(themes)) {
  console.log(`\n  ${theme.toUpperCase()}`);
  for (const [fg, bg, min, label] of [...TEXT_PAIRS, ...UI_PAIRS]) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`  ?  ${fg} on ${bg} - token missing`);
      failures++;
      continue;
    }
    const value = contrast(tokens[fg], tokens[bg]);
    const pass = value >= min;
    if (!pass) failures++;
    console.log(
      `  ${pass ? "ok" : "FAIL"}  ${value.toFixed(2)}:1 (needs ${min})  ${fg} on ${bg} - ${label}`,
    );
  }
}

console.log(
  failures === 0
    ? "\nAll token pairs meet their WCAG 2.1 AA threshold.\n"
    : `\n${failures} pair(s) below threshold.\n`,
);
process.exit(failures === 0 ? 0 : 1);
