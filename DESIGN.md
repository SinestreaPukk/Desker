---
name: Desker
description: AI employees for real work - a native desk for running your staff, the team on the left and their work beside it.
colors:
  indigo: "oklch(0.345 0.229 268.5)"
  indigo-deep: "oklch(0.290 0.205 268.5)"
  on-indigo: "oklch(0.995 0.002 270)"
  indigo-soft: "oklch(0.961 0.017 282.5)"
  indigo-soft-text: "oklch(0.511 0.174 279.8)"
  indigo-edge: "oklch(0.863 0.069 283.0)"
  grouped-ground: "oklch(0.962 0.004 286.3)"
  sidebar: "oklch(0.945 0.005 286.3)"
  inset-surface: "oklch(1 0 0)"
  fill: "oklch(0.956 0.004 286.3)"
  fill-strong: "oklch(0.932 0.005 286.3)"
  ink: "oklch(0.241 0.010 248.2)"
  ink-muted: "oklch(0.502 0.014 264.4)"
  ink-subtle: "oklch(0.611 0.015 272.6)"
  hairline: "oklch(0.887 0.010 286.2)"
  control-edge: "oklch(0.645 0.016 277.7)"
  positive: "oklch(0.500 0.092 178.8)"
  positive-soft: "oklch(0.960 0.026 181.9)"
  positive-edge: "oklch(0.856 0.064 181.2)"
  warning: "oklch(0.520 0.117 63.9)"
  warning-soft: "oklch(0.970 0.068 100.4)"
  warning-edge: "oklch(0.880 0.123 93.4)"
  danger: "oklch(0.557 0.197 25.2)"
  danger-soft: "oklch(0.955 0.021 13.9)"
  danger-edge: "oklch(0.857 0.074 17.7)"
typography:
  large-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.025em"
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.875rem"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body-large:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "-0.006em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "-0.006em"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    letterSpacing: "normal"
  meta:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Geist, ui-sans-serif, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1rem"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  panel: "0.875rem"
  full: "9999px"
spacing:
  row-y: "0.875rem"
  row-y-dense: "0.625rem"
  row-x: "1rem"
  panel: "1.25rem"
  section: "1.5rem"
  gutter: "1rem"
  gutter-wide: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.on-indigo}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.indigo-deep}"
  button-primary-sm:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.on-indigo}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2rem"
  button-secondary:
    backgroundColor: "{colors.inset-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-secondary-hover:
    backgroundColor: "{colors.fill}"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2rem"
  button-ghost-hover:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-indigo}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  inset-group:
    backgroundColor: "{colors.inset-surface}"
    rounded: "{rounded.panel}"
  run-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0.875rem 1rem"
  run-row-selected:
    backgroundColor: "{colors.indigo-soft}"
  run-row-waiting:
    typography: "{typography.body-large}"
  input:
    backgroundColor: "{colors.inset-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.75rem"
    height: "2.5rem"
  badge-accent:
    backgroundColor: "{colors.indigo-soft}"
    textColor: "{colors.indigo-soft-text}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
  badge-positive:
    backgroundColor: "{colors.positive-soft}"
    textColor: "{colors.positive}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
  sidebar-item:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.375rem 0.75rem"
  sidebar-item-selected:
    backgroundColor: "{colors.indigo-soft}"
    textColor: "{colors.indigo-soft-text}"
  sidebar-count-waiting:
    backgroundColor: "{colors.indigo-soft}"
    textColor: "{colors.indigo-soft-text}"
    rounded: "{rounded.full}"
    padding: "0 0.375rem"
    height: "1.25rem"
  sidebar-count-quiet:
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
  condensed-toolbar:
    textColor: "{colors.ink}"
    height: "2.75rem"
---

# Design System: Desker

## Overview

**Creative North Star: "Native Desk"**

Desker's app is a native desk for running your staff: one window, the team on the left, their work beside it, nothing a page away. The idiom is Apple's Mail and Reminders on the web: a grouped-background grey ground, white inset groups with hairline separators that start past the avatar, a source-list sidebar with a filled indigo selection pill and Mail-style counts, the platform's own system face, large bold titles that condense into the toolbar, and circular contact-photo avatars. Indigo (#1800AD, the logo colour) is the one tint.

Importance is shown by billing, not by decoration. What waits on the owner is pinned first and set a size up, with the page's one solid indigo action. What is running carries the only live marks: a pulsing indigo "Working" line on its row and a thin indigo now line on today's strip. Finished history packs tighter beneath. Hierarchy comes from contrast of scale (a 34px bold title over 13px body), never from capitals, tracking or a second colour, and nothing is labelled twice: a group heading that says "Running" means its rows carry no Running badge.

The public marketing site (night sky over desert dunes, an EB Garamond hero, its own uppercase mono label voice) is a separate world. The app borrows nothing from it; inside `[data-app]` every label and metadata line speaks in the system face, in sentence case.

**Key Characteristics:**
- One tint: the Desker indigo. Solid indigo is the page's one action; soft indigo is selection and "waits on you".
- Grouped grey ground with white inset groups; depth from the ground/surface step, not resting shadows.
- The system face (SF Pro, Segoe UI) first, Geist only as fallback; a locked type scale guarded by a test.
- Sentence case everywhere in the app: no uppercase, tracked or mono labels.
- Neutrals and status colours are Radix steps (slate, iris, teal, amber, red) inlined as oklch; both themes defined; every text pair gated at 4.5:1 by `npm run check:contrast`.
- Quiet, physical motion on strong ease-out curves; reduced motion and reduced transparency both honoured.

## Colors

A single indigo tint on a slate-grey grouped ground, with teal, amber and red reserved for state.

### Primary
- **Desker Indigo** (`indigo`, `--accent`): the logo colour. The page's one solid action (Review on the waiting run, Approve and send in its report), links, the focus ring, sidebar icons, the pulsing "Working" mark and the today strip's now line.
- **Deep Indigo** (`indigo-deep`, `--accent-hover`): the solid action's hover only.
- **Soft Indigo** (`indigo-soft`) with **Soft Indigo Text** (`indigo-soft-text`) and **Indigo Edge** (`indigo-edge`): selection and attention without weight. The sidebar's selected pill, the selected run row in the split view, the Work count of runs waiting on the owner, accent badges, text selection. Radix iris 3, 11 and 6.

### Neutral
- **Grouped Ground** (`grouped-ground`, `--paper`): the page ground everything sits on; a step darker than white so inset groups read as white cards of the list.
- **Sidebar** (`sidebar`, `--rail`): the source list and the base of every translucent material; defined as one step below the ground so the chrome recedes.
- **Inset Surface** (`inset-surface`, `--surface`): inset groups, the reading pane, dialogs, inputs; the brightest thing on screen in light mode.
- **Fill** (`fill`) and **Fill Strong** (`fill-strong`): row hover, ghost hover, neutral badges, inner blocks. Slate 3 and 4.
- **Ink** (`ink`): titles and body. Slate 12.
- **Ink Muted** (`ink-muted`): the metadata line, group counts, section labels, descriptions; everything read but secondary. Slate 11; clears 4.5:1.
- **Ink Subtle** (`ink-subtle`): chevrons, placeholders, decorative icons; never text somebody must read. Slate 10.
- **Hairline** (`hairline`): row separators (at 70%), inset-group borders (at 50%), the sidebar edge. Slate 6.
- **Control Edge** (`control-edge`): borders on inputs and selects (at 80%), which must clear 3:1. Slate 9.

Six avatar tones (`--av-1` to `--av-6`, tile and figure pairs) make a roster read as distinct people; each pair is contrast-checked with everything else.

### Status
- **Positive** (`positive`, `positive-soft`, `positive-edge`): Done, Published, Sent, Ready. Teal 11, darkened to pass 4.5:1.
- **Warning** (`warning`, `warning-soft`, `warning-edge`): Needs approval, Draft, Processing. Amber, leaning yellow so caution never reads as brand.
- **Danger** (`danger`, `danger-soft`, `danger-edge`): Failed, Escalated, destructive confirmation. Red.

### Named Rules
**The One Tint Rule.** Indigo is the only accent. Solid indigo marks the page's one action; on Work that is the waiting run's Review and nothing else on the list is solid indigo.

**The Status-Only Rule.** Green, amber and red always mean a state, through the one status map in the badge component. They are never emphasis or decoration.

**The Token Rule.** All colours are defined in `:root` and verified by `scripts/check-contrast.mjs` against WCAG AA standards.

## Typography

**Display Font:** the system face (system-ui, -apple-system, BlinkMacSystemFont, Segoe UI), with Geist as fallback
**Body Font:** the same system face
**Label/Mono Font:** Geist Mono (ui-monospace, SF Mono) only for code and keyboard hints; never for labels or metadata in the app

**Character:** the platform's own face with its own optical sizing, set a breath tight (-0.006em) so it reads like a native app rather than a web page. Weight and size carry every level; case never does.

### Hierarchy
- **Large Title** (700, 2.125rem, 2.5rem line): the title every app page opens with, on the ground with no band. Condenses into a 13px semibold centred title in the toolbar on scroll.
- **Display** (700, 2.75rem, line-height 1): headline figures, the Insights stat numbers.
- **Headline** (600, 1.5rem, 1.875rem): rare in-app; kept on the scale.
- **Title** (600, 1.125rem, 1.5rem): the Finished heading, the reading pane's run title, roster card names, dialog titles.
- **Body Large** (400/600, 0.9375rem, 1.5rem): the waiting run's title (semibold, billed a size up), inset-group titles, long-form prose.
- **Body** (400/500, 0.8125rem, 1.25rem): the default: row titles (medium), sidebar items, descriptions, buttons.
- **Label** (600, 0.8125rem, sentence case, normal tracking): group headings over inset groups and in-app `.eyebrow` section labels, in ink or ink-muted.
- **Caption** (400, 0.75rem, 1rem, sentence case): the metadata line under a row title (who, trigger, when), counts, in-app `.meta`.
- **Meta** (600, 0.6875rem, 1rem): the smallest text anywhere; status badge labels, the today strip's hour ticks. Nothing is set below it.

### Named Rules
**The Scale Contrast Rule.** Hierarchy is a jump in size and weight: a 34px bold title over 13px rows, a 15px semibold waiting title over 13px medium ones. Never reach for uppercase, letter-spacing or colour to rank text.

**The Sentence Case Rule.** Inside `[data-app]`, `.eyebrow` and `.meta` drop uppercase, tracking and mono. Labels read like a native app's, in the system face.

**The Locked Scale Rule.** Only the listed steps exist; Tailwind's defaults are reset, so `text-2xl` does nothing, and `tests/unit/type-scale.test.ts` fails on any off-scale or arbitrary fixed size. Radius and shadow scales are reset the same way (`rounded-xl` or `shadow-lg` would render nothing), and `tests/unit/radius-shadow-scale.test.ts` holds them to their steps.

## Layout

A two-column desk. On `lg` (1024px) and up, a sticky 15rem sidebar source list sits at full height on the left; the content column beside it is capped at 90rem and centred, with a 1rem gutter on phones and 1.5rem from `sm`. Below `lg` the sidebar becomes a sticky translucent top bar with a menu that reuses the same items (the theme switch lives there).

Pages open with the large title on the ground (1.5rem top on phones, 2.25rem from `sm`), a one-line description, then an optional controls row at a fixed 4rem on `lg` so content starts at the same height on every tab, then the body in sections 1.5rem apart. Group headings sit 0.5rem above their inset group, indented 0.25rem to align with its content.

Work is a split view at 1280px and up: the list on the left, the selected run's report in a sticky reading pane on the right (columns 1fr : 1.15fr, 1.5rem apart), with the selection held in the address (`?run=`). Below 1280px a run opens on its own page. The Roster, by user decision, keeps its card grid (one, two, then three columns) and inherits only the shell, ground, type and inset surface.

Rows pad 0.875rem vertically; finished history packs to 0.625rem. Separators start past the avatar and stop at the group's edge.

### Named Rules
**The Billing Rule.** Importance sets size and order: what waits on the owner is pinned first, its avatar and title a size up, with the page's one solid action; running and queued follow; finished history is denser and last.

**The Nothing Labelled Twice Rule.** A heading that states a state removes it from its rows: active groups ("Waiting on you", "Running", "Queued") show no status badge; only finished rows, which mix outcomes, do. Each row carries one state, and Escalated replaces the status rather than joining it.

## Elevation & Depth

Depth is tonal, not cast. White inset groups sit on the grey ground with a faint hairline edge (hairline at 50%) and no resting shadow. Shadows answer state or overlay: controls (primary and secondary buttons) carry the smallest lift, the primary rises on hover, and menus, dialogs and the hovered roster card take the overlay shadow. Chrome floats as material: the mobile top bar and the condensed title bar are a translucent sidebar-tinted material (78% sidebar, 16px blur, 160% saturation) that content scrolls under, turning solid under reduced transparency.

### Shadow Vocabulary
- **Control** (`box-shadow: 0 1px 2px hsl(var(--shadow-color) / 0.06)`): primary and secondary buttons at rest.
- **Raised** (`box-shadow: 0 2px 8px -2px hsl(var(--shadow-color) / 0.12), 0 1px 2px hsl(var(--shadow-color) / 0.06)`): primary button hover; switch thumb.
- **Overlay** (`box-shadow: 0 12px 32px -12px hsl(var(--shadow-color) / 0.24), 0 2px 6px hsl(var(--shadow-color) / 0.08)`): dialogs, dropdown menus, the hovered roster card.

### Named Rules
**The Ground-Not-Shadow Rule.** An inset group is white on grey with a hairline; it never carries a resting shadow.

**The Clear Material Rule.** Any translucent bar has a solid fallback under `prefers-reduced-transparency`, and every blur drops away there.

## Shapes

Softly rounded, growing with the size of the thing: menu items and small inner controls 0.375rem, buttons and dropdown menus 0.5rem, inputs, selects, sidebar pills and select items 0.75rem, inset groups, the reading pane and dialogs 0.875rem. Avatars, badges, sidebar counts, the switch and the now marker's head are fully round. Borders are 1px hairlines; separators inside a group are inset past the avatar, as in a native list.

## Components

### Buttons
Quiet and physical: feedback lands on pointer-down.
- **Shape:** 0.5rem; heights 2rem (sm), 2.5rem (md), 3rem (lg); icon 2.25rem and 1.75rem.
- **Primary:** solid indigo, near-white label, a 20% white inner ring, control shadow rising to raised on hover. One per screen.
- **Secondary:** white with a hairline border and ink label; hover darkens the border to control edge and fills with fill. Run agent, Edit, Reject.
- **Ghost:** muted label, no border; hover fills with fill and turns ink. Row actions and toolbars.
- **Danger:** solid red, only to confirm a destructive action in a dialog.
- **Press:** scale 0.97 on pointer-down, 150ms strong ease-out.
- **Touch:** on coarse pointers the sm, icon and icon-sm sizes carry an invisible hit area reaching 44px.
- **Focus:** a 2px indigo outline, offset 2px, on every interactive element; never removed.

### Badges and status
- **Style:** fully round, 1px edge-colour border, soft fill, tone-coloured semibold meta-size label, a 6px dot.
- **State:** every status passes through one map (runs, agents, conversations, drafts, roles), so a state reads the same everywhere; live states pulse their dot.

### Inset groups (cards / containers)
- **Corner Style:** 0.875rem.
- **Background:** inset surface on the grouped ground.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** hairline at 50%.
- **Internal Padding:** 1.25rem for headers and bodies; list groups are padding-free and let their rows pad.

### Inputs / Fields
- **Style:** white, control edge at 80%, 0.75rem radius, 2.5rem tall, 13px text; hover darkens the border.
- **Focus:** indigo border, 2px indigo outline and a 20% indigo ring.
- **Error / Disabled:** red border and ring with an inline message and icon; disabled fills with fill at reduced opacity.
- **Checkbox:** the native control, 18px, filled by `accent-color` in the brand indigo.
- **Switch:** 2.5rem by 1.5rem, control-edge off, indigo on; the thumb slides 200ms ease-in-out.

### Menus, selects and dialogs
- **Selects and menus** grow from their trigger's transform origin: scale 0.95 and fade in 200ms, out in 150ms, strong ease-out. Menus are white, 0.5rem, overlay shadow.
- **Dialogs** are centred, white, 0.875rem, overlay shadow, over a 45% black backdrop with a 2px blur; they fade and scale from 0.96 in 250ms and leave in 200ms.
- **Disclosures:** every `<details>` opens by height and opacity in 200ms where `interpolate-size` is supported, and snaps elsewhere.

### Navigation
- **Sidebar source list:** sticky, full height, sidebar tone with a hairline edge. The wordmark, then the project switcher (project name, organisation as a quiet caption beneath), then sentence-case group headings ("Workspace", "Configuration") in 12px semibold muted.
- **Items:** 13px medium ink, icon tinted indigo; hover fills with 5% ink. Selected is a filled soft-indigo pill with soft-indigo text and icon, and no side bar.
- **Counts:** Mail-style. Work shows runs waiting on the owner as a soft-indigo pill with an indigo-edge ring; Inbox shows open items as a quiet grey number.
- **Mobile:** a sticky translucent material top bar with the wordmark, Help and a menu button; the menu opens the same switcher, items and the theme switch on the sidebar tone.

### Large title
The page's title in 34px bold on the ground. Once it scrolls away, a 2.75rem translucent material bar fades in (200ms ease-out) across the content column with the title centred in 13px semibold. Wide screens only; on phones the top bar already does this job.

### Work split view (signature)
- **Today strip:** an inset group with "Today" and a run count, a hairline 24-hour line with each run's agent avatar placed at its time, hour ticks at 00, 06, 12, 18, 24, and one indigo now line with a round head. With nothing today it collapses to a single quiet line.
- **Run row:** avatar (28px; 36px when waiting), title (13px medium; 15px semibold when waiting), a caption line (agent and role, trigger, when, suggestions to review), one state, actions, a chevron. The whole row is a stretched link; actions sit beside it on a higher layer so their dialogs never open the run. Hover fills with fill at 70%; the selected row in the split view fills soft indigo.
- **Running:** the caption leads with a pulsing indigo dot and "Working · 4m" in indigo medium.
- **Reading pane:** a sticky white inset group beside the list; its content cross-fades in over 200ms on selection. A header with avatar, title, meta, state and open-in-page, then the report.
- **Report sections:** plain sections under semibold headings; in-run suggestions are hairline-separated rows, not nested cards.

### Segmented control
Every tab set is a segmented control: a quiet track (ink at 6%), the chosen segment a raised white pill with the small shadow, words only (no icons), counts beside the word when something waits. Three or so fixed choices use it instead of a dropdown (the Insights range: 7 days / 30 days / 90 days).

### List rows (Inbox)
Conversations, issues and suggestions are rows in one inset group per list, never a stack of separate cards. Every row reads like Mail: the agent's avatar as the leading figure, the agent's name on top (base size, semibold) with the time on the right, then the subject with its badges, then the detail. The agent's name appears once, never again in the metadata line. The separator starts past the leading avatar or icon tile and the last row has none; the time sits top-right as in Mail. Unread is one indigo dot before the item, never a coloured stripe plus a badge.

### Insight figures (Insights)
Health-style: the category label in the tint with its icon inline (no icon tile), the number at display size, one quiet sentence-case line; the fuller reading is the tooltip. Sections below sit Settings-style: heading and one-line description above the white group, the group holding rows or a table without a border of its own inside. The detailed view is reached by one plain row with a chevron.

### Roster card
By user decision the Roster keeps its agent card grid: an inset group with avatar, name (title size), role, run mode badge, counts in small fill chips, and a footer line. On hover or focus-within it lifts 2px, darkens its border and takes the overlay shadow, and its name turns indigo.

### Named Rules
**The One Now Rule.** One live marker for time: the today strip's indigo now line. Running rows pulse their own dot; nothing else on the page animates to say "live".

## Do's and Don'ts

### Do:
- **Do** keep one solid indigo action per screen; on Work it is the waiting run's Review.
- **Do** pin what waits on the owner first and bill it a size up (36px avatar, 15px semibold title).
- **Do** let a group heading carry the state and keep status badges for rows whose group does not say it; one state per row, Escalated replacing status.
- **Do** start row separators past the avatar and keep rows inside a white inset group on the grey ground.
- **Do** write in-app labels and metadata in sentence case, in the system face, with normal tracking.
- **Do** place row actions beside a stretched link, and give small controls a 44px hit area on coarse pointers.
- **Do** define every new colour in both themes and run `npm run check:contrast` before shipping.
- **Do** give any translucent material a solid fallback under reduced transparency, and keep motion at 150-250ms on the strong ease-out curve.

### Don't:
- **Don't** introduce a second accent colour or use green, amber or red for anything but a state.
- **Don't** put a resting shadow on an inset group.
- **Don't** set labels or metadata in uppercase, tracked or mono inside the app; that voice belongs to the public site.
- **Don't** borrow the marketing world (night sky, dunes, EB Garamond, glass buttons) inside the app.
- **Don't** mark sidebar selection with a side bar; the filled pill is the mark.
- **Don't** nest cards inside a run's report; suggestions are hairline rows.
- **Don't** label a thing twice: no Running badge under a "Running" heading.
- **Don't** add a second live "now" indicator beside the today strip's line.
- **Don't** use a font size outside the locked scale.
- **Don't** turn the Roster's card grid into a list; the list idiom applies to the shell and Work.
