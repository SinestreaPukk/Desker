---
name: Desker Personal
description: A sticky-note studio for one person and one assistant; navy ink on white paper, one ink blue that acts, soft notes that carry the charm.
colors:
  ink-blue: "oklch(0.527 0.218 267.4)"
  ink-blue-deep: "oklch(0.442 0.187 267.4)"
  ink-blue-wash: "oklch(0.910 0.047 242.5)"
  navy-ink: "oklch(0.288 0.052 265.1)"
  navy-ink-muted: "oklch(0.495 0.041 264.1)"
  navy-ink-subtle: "oklch(0.650 0.036 261.0)"
  white-paper: "oklch(0.984 0.005 258.3)"
  card-white: "oklch(1 0 0)"
  slate-wash: "oklch(0.965 0.010 258)"
  slate-wash-deep: "oklch(0.940 0.014 258)"
  nav-rail: "oklch(0.968 0.009 258)"
  hairline: "oklch(0.914 0.017 259.4)"
  control-edge: "oklch(0.632 0.036 264.3)"
  note-lemon: "oklch(0.930 0.117 96)"
  note-sky: "oklch(0.910 0.047 242.5)"
  note-mint: "oklch(0.920 0.051 164.8)"
  note-coral: "oklch(0.895 0.057 37.2)"
  note-lilac: "oklch(0.889 0.063 299.3)"
  positive: "oklch(0.500 0.092 178.8)"
  positive-soft: "oklch(0.960 0.026 181.9)"
  warning: "oklch(0.539 0.162 40)"
  warning-soft: "oklch(0.967 0.018 48.5)"
  danger: "oklch(0.557 0.197 25.2)"
  danger-soft: "oklch(0.955 0.021 13.9)"
typography:
  large-title:
    fontFamily: "Caveat, Bradley Hand, cursive"
    fontSize: "2.125rem"
    fontWeight: 400
    lineHeight: "2.5rem"
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Quicksand, ui-rounded, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  title:
    fontFamily: "Quicksand, ui-rounded, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Quicksand, ui-rounded, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "-0.006em"
  label:
    fontFamily: "Quicksand, ui-rounded, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  meta:
    fontFamily: "Quicksand, ui-rounded, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.875rem"
  panel: "1.125rem"
  note: "3px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page-width: "768px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.white-paper}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.navy-ink-muted}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.panel}"
    padding: "20px"
  nav-tab-active:
    backgroundColor: "{colors.note-lemon}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  segmented-tab-active:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.full}"
    padding: "4px 14px"
  chat-bubble-user:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.white-paper}"
    rounded: "{rounded.panel}"
    padding: "10px 16px"
  chat-bubble-agent:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.panel}"
    padding: "10px 16px"
---

# Design System: Desker Personal

## Overview

**Creative North Star: "The Sticky-Note Studio"**

A clean desk: crisp white paper, navy ink, and a drawer of soft stationery notes. One clear ink blue is the only solid color and the only thing that acts (buttons, links, the user's chat bubble, the focus ring). Everything else is white, slate, or a pale note fill under navy ink. Vivid yet calm; nothing neon, nothing brown.

The product is Operate mode with three bare screens (Agent, Integrations, Productivity). Density is low: one 768px column, a handwritten page title, one plain line under it, then the content. The charm is carried by two devices only: the Caveat hand on page titles and empty-state headings, and the tilted lemon/sky/mint note that marks the active top-bar tab.

**Key Characteristics:**
- One solid color (ink blue); notes are pale fills, never solid.
- Quicksand everywhere; Caveat only for written moments (page title, empty-state heading).
- Flat white panels with a faint hairline; shadow is reserved for notes, hover and popovers.
- Pill buttons, 18px panels, 3px note corners.
- Plain short copy; no kickers, no nested cards.

## Colors

Cool white paper and navy ink, one ink blue, five pale notes.

### Primary
- **Ink Blue** (frontmatter `ink-blue`, #3558E6): every primary button, link, the user's chat bubble, the focus ring, field focus border. Deep variant on hover.

### Secondary
- **Sticky-note fills** (`note-lemon`, `note-sky`, `note-mint`, `note-coral`, `note-lilac`): pale fills always under navy ink. Lemon, sky and mint are the active-tab notes for Agent, Integrations and Productivity; lemon also tints the inline notice in chat. A note's color says whose note it is, never a status. The `Note` primitive mixes a note color 55% into white.

### Neutral
- **Navy Ink** (`navy-ink`, #1E2A45 family): body and headings. Muted is for hints and meta text; subtle is only for icons, placeholders and markers, never read text.
- **White Paper** (`white-paper`) is the page; **Card White** is panels, inputs and agent bubbles; **Slate Wash** is hover and disabled fills; **Nav Rail** is the translucent top bar.
- **Hairline** for panel and divider borders; **Control Edge** for input borders (clears 3:1).
- Status: `positive` (teal), `warning` (coral-orange, "waiting on you"), `danger` (red), each with a soft fill for badges and notices.

### Named Rules
**The One Solid Rule.** Ink blue is the only saturated solid on a screen. Notes stay pale, status colors stay in badges and notices.
**The Note Is Not A Status Rule.** Never use a note color to signal state.

## Typography

**Display Font:** Caveat (with Bradley Hand, cursive)
**Body Font:** Quicksand (with ui-rounded, system-ui)
**Label/Mono Font:** Quicksand in the app; Geist Mono exists for the public site and is not used on these screens.

**Character:** A rounded, calm sans carries all information; the hand appears only where a person would write on a note.

### Hierarchy
- **Large title** (Caveat, 2.125rem/2.5rem): the one page title in `Screen`.
- **Headline** (Quicksand 600, 1.125rem): empty-state and prose headings; the empty chat heading uses Caveat at 1.5rem.
- **Title** (600, 0.9375rem): panel titles, tight tracking.
- **Body** (400, 0.9375rem/1.5rem): default text, bubbles and hints at 0.8125rem.
- **Label** (500, 0.8125rem): field labels, buttons, tabs.
- **Meta** (0.75rem, muted): timestamps, hints, counts; nothing smaller than 0.6875rem.

### Named Rules
**The Locked Scale Rule.** Only the sizes in the theme exist; Tailwind's defaults are reset, so an off-scale size cannot be written.
**The Hand Is Rare Rule.** Caveat is for the page title and one empty-state heading, never for controls or data.

## Layout

One centered column, max 768px (`max-w-3xl`), 16px side padding rising to 24px at `sm`. Screens open with top padding 32px (48px at `sm`), a title block, 32px gap, then content; bottom padding 96px. The top bar is 56px, sticky and translucent, with logo left, three tabs centered, account avatar right. Agent sub-sections are a horizontally scrolling segmented control. Spacing runs on a 4px base with 8, 12, 16, 20, 24 as the common steps. On touch, small controls get an invisible hit area reaching 44px.

## Elevation & Depth

Mostly flat and tonal: white panels on white paper separated by a hairline. Shadows are tinted navy (`--shadow-color` 228 35% 25%) and used sparingly.

### Shadow Vocabulary
- **xs** (`0 1px 2px hsl(228 35% 25% / 0.06)`): active tab, primary and secondary buttons, resting chat frame.
- **sm** (`0 2px 8px -2px hsl(... / 0.12), 0 1px 2px hsl(... / 0.06)`): button hover, selected segment, popovers.
- **md**: dialogs.
- **Note** (`0 14px 26px -16px hsl(... / 0.45), 0 1px 2px hsl(... / 0.12)`): sticky notes only.

### Named Rules
**The Flat Panel Rule.** Panels carry no shadow at rest; only notes and pressed-state controls lift.

## Shapes

Soft and round. Buttons and segmented tabs are pills (9999px); inputs 14px; inner blocks 14px; panels and chat bubbles 18px, with the bubble's speaker-side corner squared to 4px; the top-bar tabs 10px; sticky notes nearly square (3px) with a slight tilt (the active tab is rotated -1deg). Washi tape and the folded corner exist as `.note` options but are not used on these screens.

## Components

### Buttons
- **Shape:** pill, heights 32 / 40 / 48px (default 40px), text 0.8125rem medium.
- **Primary:** ink blue fill, near-white text, faint inner white ring, xs shadow.
- **Hover / Focus:** deeper blue, sm shadow; press scales to 0.97 in 150ms strong ease-out; focus is a 2px ink-blue outline offset 2px.
- **Secondary / Ghost / Danger / Link:** white with hairline border; muted text with slate hover; red fill; underlined ink blue. Disabled is 50% opacity.

### Panels
- **Corner Style:** 18px. **Background:** card white with a half-strength hairline border. **Padding:** 20px. Title 0.9375rem semibold, one muted 0.75rem line beneath. Footer is a tinted strip with a top hairline. Never nest a panel in a panel.

### Inputs / Fields
- **Style:** white, 1px control-edge border (80%), 14px radius, 40px height; textarea min 96px.
- **Focus:** border turns ink blue with a 2px outline and a 20% ink-blue ring.
- **Error:** red border and ring, alert text with icon below; hints sit below in muted 0.75rem. Every field goes through `Field` for label wiring.

### Navigation
Top bar: translucent rail with blur, hairline underside. Tabs are 0.8125rem semibold; inactive are muted with a faint ink hover; the active tab becomes its own note color (lemon, sky, mint) with a xs shadow and -1deg tilt. Segmented sub-tabs: a pill track of 6% ink with the active segment a raised white pill.

### Chat
A white 14px-radius frame with a hairline, scrolling messages above a hairline-topped composer. User bubbles are solid ink blue, agent bubbles white with hairline, both with a squared corner on the speaker side. A blinking ink-blue caret shows streaming.

## Do's and Don'ts

### Do:
- **Do** frame every screen in `Screen`: hand title, one plain muted line, content.
- **Do** keep ink blue for the one action, and pale note fills under navy ink for identity.
- **Do** use the shared `Button`, `Field`, `Panel` and `Tabs` primitives and the locked type scale.
- **Do** keep copy short and plain; every field must earn its place.
- **Do** honor reduced motion and transparency, and keep the 2px focus ring.

### Don't:
- **Don't** nest cards or panels.
- **Don't** use a note color to signal status, or a solid fill other than ink blue.
- **Don't** set Caveat on controls, data or body text.
- **Don't** add off-scale font sizes, new radii or hard offset shadows.
