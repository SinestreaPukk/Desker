#!/usr/bin/env node
/**
 * WCAG contrast audit of the design tokens in src/app/globals.css.
 *
 * Parses the oklch() values out of the :root block, converts
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

/** Whether an oklch colour survives the trip to sRGB without clipping. */
function inGamut(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].every((v) => v >= -0.001 && v <= 1.001);
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
const outOfGamut = [];

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
    const lch = [Number(match[2]), Number(match[3]), Number(match[4])];
    tokens[match[1]] = oklchToSrgb(...lch);
    if (!inGamut(...lch)) outOfGamut.push(`${selector} --${match[1]}`);
  }
  return tokens;
}

const light = tokensFrom(":root");
const themes = { light };

// --- the pairs the UI actually renders -------------------------------------

const TEXT_PAIRS = [
  ["ink", "paper", 4.5, "body text on the page"],
  ["ink", "surface", 4.5, "body text on a card"],
  ["ink", "surface-2", 4.5, "body text on a raised panel"],
  ["ink-muted", "paper", 4.5, "secondary text on the page"],
  ["ink-muted", "surface", 4.5, "secondary text on a card"],
  ["ink", "rail", 4.5, "navigation label on the rail"],
  ["ink-muted", "rail", 4.5, "inactive navigation label on the rail"],
  // .meta moved to ink-muted; ink-subtle is now only icons, placeholders and
  // list markers, which are non-text and answer to 3:1.
  ["ink-subtle", "paper", 3.0, "icon tints and placeholders (non-text)"],
  ["primary-fg", "primary", 4.5, "primary button label on the pastel blue"],
  ["primary-fg", "primary-hover", 4.5, "primary button label, hovered"],
  ["accent-fg", "accent", 4.5, "label on a solid accent mark"],
  ["accent-soft-fg", "accent-soft", 4.5, "accent badge"],
  ["positive", "positive-soft", 4.5, "published badge"],
  ["warning", "warning-soft", 4.5, "draft / medium badge"],
  ["danger", "danger-soft", 4.5, "error text and critical badge"],
  ["danger", "paper", 4.5, "inline error message"],
  ["accent", "paper", 4.5, "accent link on the page"],
  ["accent", "surface", 4.5, "accent link on a card"],
  ["primary-fg", "primary", 4.5, "primary button label"],
  ["danger-fg", "danger", 4.5, "danger button label"],
  ["positive-fg", "positive", 4.5, "label on a solid positive fill"],
];

// Avatars: a navy face on a sticky-note colour field. The face is what
// identifies the character, so it is held to text contrast on its field.
for (let i = 1; i <= 6; i++) {
  TEXT_PAIRS.push(["av-face", `av-${i}-fg`, 4.5, `avatar tone ${i}: face on its colour`]);
}

// Sticky notes carry navy ink only; hold every colour to text contrast.
for (const note of ["lemon", "sky", "mint", "coral", "lilac"]) {
  TEXT_PAIRS.push(["note-ink", `note-${note}`, 4.5, `text on a ${note} sticky note`]);
}

// Non-text: borders and focus rings need 3:1 against what they sit on.
const UI_PAIRS = [
  ["brand", "paper", 3.0, "the ink-blue logo on the page"],
  ["brand", "rail", 3.0, "the ink-blue logo on the sidebar"],
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

// Informational: oklch past sRGB is deliberate for some tokens (the saturated
// is wider on a P3 screen). The ratios above are computed on the clipped
// sRGB value, which is the conservative reading.
if (outOfGamut.length) {
  console.log(`\n  note  past sRGB, clipped for the ratios above: ${outOfGamut.join(", ")}`);
}

// The hex mirrors in src/lib/brand.ts must match the tokens they copy.
const brand = readFileSync(join(root, "src", "lib", "brand.ts"), "utf8");
const mirror = /TOKEN_HEX = \{([\s\S]*?)\}/.exec(brand)?.[1] ?? "";
console.log("\n  HEX MIRRORS (src/lib/brand.ts)");
for (const [, key, hex] of mirror.matchAll(/"?([\w-]+)"?:\s*"(#[0-9A-Fa-f]{6})"/g)) {
  const token = themes.light[key];
  if (!token) {
    console.log(`  ?  ${key} - no such token`);
    failures++;
    continue;
  }
  const want = token.map((v) => Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255));
  const got = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const drift = Math.max(...want.map((v, i) => Math.abs(v - got[i])));
  const pass = drift <= 2;
  if (!pass) failures++;
  const expected = "#" + want.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  console.log(`  ${pass ? "ok" : "FAIL"}  ${key} ${hex}${pass ? "" : ` (token is ${expected})`}`);
}

console.log(
  failures === 0
    ? "\nAll token pairs meet their WCAG 2.1 AA threshold.\n"
    : `\n${failures} pair(s) below threshold.\n`,
);
process.exit(failures === 0 ? 0 : 1);
