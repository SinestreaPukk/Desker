# Colour system

Blue stays the brand. One warm tone, **ember** (a light apricot), is added so
the page has a "click here" colour that isn't also the colour of everything
else. Tokens live
in `src/app/globals.css`. `npm run check:contrast` gates every pair below.

## The split: 60 / 30 / 10

| Share | What | Tokens |
|---|---|---|
| ~60% | Neutrals: paper, surfaces, ink, lines | `--paper` `--surface*` `--ink*` `--line*` |
| ~30% | Brand blue: indigo for identity and interaction, sky for atmosphere | `--accent*`, `--sky*`, `--dune-*` |
| ~10% | Ember: the one thing each view wants clicked or noticed | `--ember*` |

Ember works because it's rare. If it shows up on every card, it stops pulling the eye.

## Why apricot, and why light

The first pass used a burnt orange (`oklch(0.58 0.184 39)`, ≈#D04400, with white
type). It was rejected: next to the sky it read as rust. Colour theory explains
why, and the fix follows from it.

1. **The natural order of hues.** Every hue has a lightness it looks purest at.
   Yellow and orange peak light, blue and violet peak dark. A harmonious pair
   keeps that order: dark blue against light warm. The burnt orange broke it.
   To make white type pass, the orange was pushed down to lightness 0.58, and a
   dark orange is brown. **So ember stays light, and its type is dark.**
2. **The complement is measured perceptually.** In OKLCH the sky (hue 255) is
   opposite hue **75**, which is gold. The indigo (268) is opposite 88. The old
   orange at hue 39 was 36° off the complement, a slightly off pairing, and it
   clashed.
3. **Gold is the true complement but can't be used here.** Gold means caution
   in UI. It sits on top of `--warning`, so a gold Approve next to a yellow
   "Needs approval" badge reads as one colour (see
   `redesign/mocks/accent-candidates.png`).
4. **Split-complementary.** One step off the complement toward red gives
   **apricot, hue 55**. It keeps most of the complement's contrast with the
   blue, stays clear of warning (37° away) and of danger (28° away, and very
   different in lightness), and still reads as warm and friendly rather than
   as an alarm.

The four candidates, rendered on the sky and beside the warning badge
(`accent-candidates.png`):

| Candidate | Hue | Verdict |
|---|---|---|
| Sun gold | 78 (true complement) | Most harmonious with the sky, but it reads as warning. Rejected. |
| Marigold | 68 | Same problem, slightly less. Rejected. |
| **Apricot** | **55** (split complement) | **Chosen.** Harmonious, distinct, clean at high lightness. |
| Coral | 32 | Close to danger red. Approve would look destructive. Rejected. |

Blue and orange is also the pair that holds up best under red-green colour
blindness, because it sits on the blue-yellow axis that protan and deutan
vision keep.

## Roles (use them the same way everywhere)

| Colour | Used for | Never for |
|---|---|---|
| **Indigo** `--accent` | Brand, links, focus rings, selected/active states, navigation, everyday primary buttons in the app (Save, Publish, Run) | — |
| **Sky** `--sky*` | Hero and final-CTA atmosphere, page headers, large surfaces | UI controls, text other than the white type sitting on it |
| **Ember** `--ember*` | The primary CTA, the "Most popular" plan, the Approve moment, key numbers (in `--ember-ink`), small highlight underlines, the demo's active-tab progress bar | Body text, large backgrounds, more than ~2 elements per view, status badges, any mark a reader depends on (use `--ember-ink`) |
| **Warning** `--warning*` | Caution states: Draft, Needs approval, Processing | Emphasis or marketing |

## Tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ember` / `--ember-fill` | `oklch(0.770 0.156 55)` #FF9646 | `oklch(0.790 0.145 58)` #FFA153 | Button fill and decorative mark |
| `--ember-hover` | `oklch(0.730 0.165 52)` #F68534 | `oklch(0.835 0.115 62)` | Hover, and the foot of the glass gradient |
| `--ember-fg` | ink #161922 (8.10:1) | `oklch(0.195 0.040 50)` (9.18:1) | Type on the fill |
| `--ember-ink` | `oklch(0.520 0.140 48)` #A74A04 (5.58:1 on paper) | `oklch(0.830 0.115 60)` (11.1:1) | Ember words and numbers |
| `--ember-soft` / `--ember-line` | #FFF1E8 / #FFCBA9 | deep apricot tints | Ember badge ground and border |
| `--ember-shadow` | fill @ 45% | fill @ 30% | The CTA's glow |

`--ember` and `--ember-fill` hold the same value today. They are separate so a
decorative mark can be tuned without touching the button.

**Limitation:** bright apricot is 2.07:1 on the paper. That's fine for a
button, because the button is identified by its dark label (8.1:1). It isn't
fine for a mark someone needs to read, so meaningful ember on a light ground
always uses `--ember-ink`. Underlines and the demo's progress bar only
decorate text that is already legible.

## Ember vs. warning vs. danger

Warning moved toward yellow: text at hue 85, soft and line at 92 (they were
75–85). Apricot sits 32–37° from warning in both themes and 28–31° from
danger. The contrast check fails if the gap to warning drops below 30° or the
gap to danger below 25°.

## Avatar palette

`--av-4` was orange (hue 55–62), exactly ember's hue. It's now moss (hue
118–125). The six tones are indigo, teal, green, moss, pink and purple, and
none of them is within 60° of ember.

## Primary CTA: solid ember vs. indigo with an ember accent

Both options were mocked on the real hero and pricing (`mocks/cta-A-*` and
`cta-B-*`, taken with the first-pass orange; the final result is in
`cta-final-*`). The decision stands with the new colour, and it's stronger now:

- On the sky, neither button has a lightness edge. The indigo glass is 1.02:1
  against the deep sky, so it's blue on blue. Ember stands out by hue (160°
  from the sky).
- B puts two colours into one small element.
- Solid ember gives it one meaning across the landing page and the app: the
  thing to do next. In the app, indigo stays the everyday primary button.

At 390px, two ember buttons in the first screen competed with each other.
While the header is clear over the sky, its button is a white outline (the
headline's pair, 4.66:1). It turns ember after you scroll past the hero.

## Accessibility

`npm run check:contrast` (part of `npm run verify`) checks, in both themes:

- every text pair at 4.5:1 and every UI or non-text pair at 3:1, including
  all the ember pairs, `--danger-fg`, `--positive-fg`, and the six avatar
  tiles
- hue separation: ember vs. warning (text and soft) and ember vs. `--av-4`,
  each ≥30°; ember vs. danger ≥25°
- the hex mirrors in `src/lib/brand.ts` (browser theme-color, social card)
  against the tokens they copy, within ±2 per channel
- tokens outside sRGB are listed as a note. Some, like the indigo, are
  deliberately wider on P3 screens, and the ratios use the clipped sRGB
  value, which is the conservative reading.

`/design-system` shows the same pairs, measured live in the browser.

Found and fixed along the way: in dark mode the danger button and the inbox
counter put white text on a lifted red (2.47:1). Both now use `--danger-fg`
(7.36:1).

## Hard-coded colours (Phase 0 list)

| Was | Now |
|---|---|
| `layout.tsx` theme-color `#fafaff` / `#141319` (didn't match the paper) | `TOKEN_HEX.paper` / `paper@dark`, drift-checked |
| `opengraph-image.tsx` five hex values | `TOKEN_HEX`, plus an apricot rule under the headline |
| Horizon SVG, six `oklch()` stops | `--dune-*` tokens |
| Arbitrary black shadows in Panel, Dialog, the client chat | `shadow-xs` / `shadow-md` (brand-tinted scale) |
| `text-white` on danger / positive fills (button, inbox counter, demo) | `text-danger-fg` / `text-positive-fg` |

Left as literals on purpose:

- `public/embed.js`: runs on customers' sites and can't read our variables.
  Its default launcher is `BRAND.color`.
- `mask-image` `#000` and the avatar mask `#fff`: masks, not visible colour.
- The Switch thumb `bg-white`, the dialog scrim `bg-black/45`, and the
  alpha-white sheen rings on buttons: neutral, and the same in both themes.
- `public/widget-demo.html`: a stale standalone demo page (old warm palette).
  Retheme it or delete it in Phase 4.
