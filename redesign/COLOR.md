# Colour system

Blue stays the brand. One warm tone, **ember**, is added so the page has a
"click here" colour that isn't also the colour of everything else. Tokens live
in `src/app/globals.css`. `npm run check:contrast` gates every pair below.

## The split: 60 / 30 / 10

| Share | What | Tokens |
|---|---|---|
| ~60% | Neutrals: paper, surfaces, ink, lines | `--paper` `--surface*` `--ink*` `--line*` |
| ~30% | Brand blue: indigo for identity and interaction, sky for atmosphere | `--accent*`, `--sky*`, `--dune-*` |
| ~10% | Ember: the one thing each view wants clicked or noticed | `--ember*` |

Ember works because it's rare. If it shows up on every card, it stops pulling the eye.

## Why orange

Blue's complement on the wheel is orange. A complementary pair gives the most hue
contrast possible, so one small ember element stands out against a lot of blue.
It is also the colour pair that holds up best under red-green colour blindness,
because blue and orange sit on the blue-yellow axis that protan and deutan
vision keep.

## Roles (use them the same way everywhere)

| Colour | Used for | Never for |
|---|---|---|
| **Indigo** `--accent` | Brand, links, focus rings, selected/active states, navigation, everyday primary buttons in the app (Save, Publish, Run) | — |
| **Sky** `--sky*` | Hero and final-CTA atmosphere, page headers, large surfaces | UI controls, text other than the white type sitting on it |
| **Ember** `--ember*` | The primary CTA, the "Most popular" plan, the Approve moment, key numbers, small highlight underlines, the demo's active-tab progress bar | Body text, large backgrounds, more than ~2 elements per view, status badges |
| **Warning** `--warning*` | Caution states: Draft, Needs approval, Processing | Emphasis or marketing |

## Tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ember` | `oklch(0.665 0.186 40.5)` #EE6227 | `oklch(0.771 0.142 43.5)` #FF9467 | Bright mark: underline, progress, dot. Non-text (≥3:1). |
| `--ember-fill` | `oklch(0.580 0.184 39)` ≈#D04400 | `oklch(0.735 0.160 42)` | Button fill |
| `--ember-hover` | `oklch(0.525 0.169 39)` #B63A00 | `oklch(0.790 0.128 44)` | Button hover, foot of the glass gradient |
| `--ember-fg` | near-white | `oklch(0.195 0.040 40)` | Type on the fill |
| `--ember-ink` | `oklch(0.529 0.160 39.4)` #B4400F | `oklch(0.800 0.123 46)` | The rare ember word or number |
| `--ember-soft` / `--ember-line` | #FFF1EB / #FFD4C2 | deep rust tints | Ember badge ground and border |
| `--ember-shadow` | fill @ 40% | fill @ 30% | The CTA's glow |

### How this differs from the starting values

- **`#F2672E` can't carry white text.** It measures 3.11:1, and a button label
  needs 4.5:1. It is kept (as `--ember`, nudged to #EE6227 so it clears 3:1
  on the off-white paper) for marks that aren't text. The button uses
  `--ember-fill`. That's the brightest ember at this hue where white text
  clears 4.5:1 (4.58:1), and it sits between the suggested `--ember-hover` and
  `--ember-ink`.
- `--ember-ink` stays at the suggested #B4400F: 5.46:1 on the paper, 5.16:1 on
  `--ember-soft`.
- In dark mode, ember lifts the same way indigo already does: a bright fill
  with dark type (7.4:1), and #FF9467 for ember text (8.9:1). The public site
  is always light, so dark ember only shows up in the app.

## Ember vs. warning

The old warning was hue 75, an amber-brown, about 35° from ember. "Needs
approval" (warning) sits right next to an ember Approve button, so it was
moved toward yellow: text at hue 85, soft and line at 92. The gap is now
46–50° in both themes, and the contrast check fails if it ever drops below
30°. The warning badge still passes (5.91:1 light, 8.09:1 dark).

## Avatar palette

`--av-4` was orange (hue 55–62), so every fourth agent would have looked like
a second copy of ember. It's now moss (hue 118–125). The six tones are indigo,
teal, green, moss, pink and purple. None of them is within 75° of ember.

## Primary CTA: solid ember vs. indigo with an ember accent

Both were mocked on the real hero and pricing
(`redesign/mocks/cta-A-*`, `cta-B-*`; final result in `cta-final-*`).

| | A: solid ember | B: indigo glass + ember arrow disc |
|---|---|---|
| Label contrast | 4.58–5.74:1 | 4.76–10.2:1 |
| Edge vs. deep sky (lightness) | 1.01:1 | 1.02–2.19:1 |
| Hue gap to the sky | **144°** | 7° |
| Edge vs. paper (pricing) | 4.45:1 | 12.25:1 |
| Colours inside the button | 1 | 2 (indigo + orange disc) |
| Reads as "the one action" in the app | Yes: nothing else is ember | No: indigo is every primary button |

**Chosen: A, solid ember.** On the sky, neither button has a lightness edge
against the background. Both are about 1:1 at the top of the gradient. So what
makes a button stand out there is hue, and B's indigo is blue on blue. B's
label contrast is higher, but both pass AA. B puts two colours into one small
element, which is the extra noise we wanted to avoid. The orange disc is also
a weak graphic (white arrow on bright ember is 3.1:1). A makes the CTA the
only warm thing in the viewport. It also keeps one meaning for ember across
the landing page and the app: the thing to do next.

**One adjustment from the mock:** at 390px, two ember buttons in the first
screen (nav plus hero) competed with each other. While the header is clear
over the sky, its button is now a white outline. The type and rim use the
headline's pair, 4.66:1. It turns ember once you scroll past the hero.

## Accessibility

`npm run check:contrast` (part of `npm run verify`) checks, in both themes:

- every text pair at 4.5:1 and every UI or non-text pair at 3:1, including
  all the ember pairs, `--danger-fg`, `--positive-fg`, and the six avatar
  tiles
- hue separation: ember vs. warning (text and soft) and ember vs. `--av-4`,
  each ≥30°
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
| `opengraph-image.tsx` five hex values | `TOKEN_HEX`, plus an ember rule under the headline |
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
