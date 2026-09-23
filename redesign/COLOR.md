# Colour system

**One colour family: the brand indigo, on neutral paper.** Emphasis comes from
contrast (white on indigo, indigo on white), not from a second hue. Tokens live
in `src/app/globals.css`. `npm run check:contrast` gates every pair.

## How we got here

The brief asked for a warm second tone ("ember") for the call to action. We
tried three versions, and all three were rejected by eye:

| Tried | Why it failed |
|---|---|
| Burnt orange `#D04400`, white label | Orange at a low lightness turns to rust (natural order of hues). |
| Apricot `#FF9646`, dark label | Cleaner, but still read as foreign to an indigo brand. |
| A dawn sky (indigo → violet → orchid → peach) with sunrise ribbons | Six hues in the hero. It looked like a different site from the rest of the page, and it diluted the button. |

Final comparison of the CTA: `mocks/cta-color-candidates.png` (A white/indigo,
B aqua, C lime, D sun gold). **A was chosen.**

## The palette

| Share | What | Tokens |
|---|---|---|
| ~60% | Neutrals: paper, surfaces, ink, lines | `--paper` `--surface*` `--ink*` `--line*` |
| ~35% | Brand indigo family: logo indigo for identity and action, and the sky (its tints and shades) for atmosphere | `--accent*`, `--sky*`, `--ribbon-*` |
| ~5% | Warmth, once: the sun in the hero | `--sun-*` |
| — | Semantic only: positive, warning, danger | never used for emphasis |

### The sky (tonal, identical in both themes)

| Token | Value | Role |
|---|---|---|
| `--sky-top` | `oklch(0.340 0.200 270)` | Zenith: the logo indigo. Also the label of the white CTA. |
| `--sky-deep` | `oklch(0.440 0.190 272)` | The band all white type sits on (8.2:1) |
| `--sky` | `oklch(0.700 0.110 276)` | Periwinkle, behind the product |
| `--sky-pale` | `oklch(0.930 0.030 280)` | Lavender mist into the paper. Also the pale section washes. |
| `--ribbon-*` | tints at hue 255–300 | The horizon ribbons. One warm end under the sun. |
| `--sun-*` | gold core, apricot rim | The only warm element |
| `--cloud` | lavender white | |

## Roles

| Element | On the sky | On a light section |
|---|---|---|
| Primary call to action | **White button, indigo label** (`.cta-sky`, 12.6:1) | **Solid indigo** `Button` (primary, 12:1) |
| Header call to action | White outline (the headline's pair, 8.2:1+) | Solid indigo (`.nav-cta`) once the header frosts |
| Most popular plan, key numbers, underlines, active tab | — | Indigo (`accent`, `accent-soft`, `sky-deep` for the underline) |
| Approve (demo and app) | — | Primary indigo button next to the yellow "Needs approval" badge |

There is one primary action per screen. What makes it stand out is that it's
the only solid indigo (or, on the sky, the only white) element, not a
different hue.

## Other decisions that stand

- **Warning** moved toward yellow (hue 85/92), so caution reads as caution.
- **`--av-4`** is moss rather than orange.
- **Dark mode:** `--danger-fg` / `--positive-fg` fix white-on-lifted-colour
  labels (the dark danger button was 2.47:1, now 7.36:1).
- **The CTA label uses `--sky-top`, not `--accent`:** the sky is the same in
  both themes, while `--accent` lifts to periwinkle in dark (2.57:1 on white,
  which the check caught).

## Accessibility checks (`npm run check:contrast`, both themes)

- Every text pair at 4.5:1 and every UI pair at 3:1, including the white CTA,
  `--danger-fg`, `--positive-fg`, and the six avatar tiles.
- White type on `--sky-top` (12.6:1) and `--sky-deep` (8.2:1). The lowest
  white text sits at 46–52% of the hero at 390/768/1280/1440, above where the
  deep band ends (63%).
- The hex mirrors in `src/lib/brand.ts` (theme-color, social card) are
  drift-checked against their tokens.
- Tokens past sRGB are listed as a note: some, like the indigo, are deliberately
  wider on P3 screens.

## Hard-coded colours (Phase 0 list)

| Was | Now |
|---|---|
| `layout.tsx` theme-color `#fafaff` / `#141319` | `TOKEN_HEX.paper` / `paper@dark` |
| `opengraph-image.tsx` five hex values | `TOKEN_HEX` |
| Horizon SVG, six `oklch()` stops | `--ribbon-*` tokens |
| Arbitrary black shadows (Panel, Dialog, client chat) | `shadow-xs` / `shadow-md` |
| `text-white` on danger / positive fills | `text-danger-fg` / `text-positive-fg` |

Left as literals on purpose:

- `public/embed.js`: runs on customers' sites. Its default launcher is `BRAND.color`.
- Masks (`#000`, `#fff`): not visible colour.
- The Switch thumb, the dialog scrim, and the alpha-white sheen rings.
- `public/widget-demo.html`: stale, to retheme or delete in Phase 4.
