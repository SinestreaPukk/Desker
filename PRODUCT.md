# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, one private space, one assistant. They reach it in a chat app (LINE, Telegram) or on the web, check in a few times a day, hand over small jobs and say yes or no to anything that would leave their hands.

## Product Purpose

Desker Personal is a single AI assistant that knows its owner, works for them and asks before anything goes out. The web app exists to configure that assistant, talk to it, and connect the apps it works through. Success: a person sets it up in two minutes, connects one app, and rarely needs to come back.

## Screens (bare minimum, decided 2026-10-03; sidebar layout from 2026-10-04)

1. **Chat**: the conversation, full page (the landing screen).
2. **Agent**: settings. About you (name, About you, files, rules), Memory (what it has learned: a searchable list, edit or forget each fact), Abilities (what it can do; apps-gated ones stay off until connected), Schedule (any number of routines). No model picker.
3. **Integrations**: connect LINE, Telegram, Gmail, Calendar, Slack, GitHub and social accounts; choose what reaches you there.
4. **Productivity**: intentionally blank for now.

Everything else (roster, approvals page, work log, audit, money, workflows, organisation) is gone from the UI.

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind 4, Radix primitives, Prisma on Postgres, Inngest for background work. Deployed at https://personal.desker.dev.
- The assistant keeps the About-you text current from what the person says in chat; the person can edit it.
- Nothing leaves without approval; approvals arrive in the connected chat app and as Approve / Decline buttons in the web chat.
- Browser (2026-10-03): it drives a hosted cloud browser (Browserbase) with Claude computer use to search flights and prices, fill in forms and sign up. It prepares first and stops before any final step; the person chooses to approve each final step or the whole job once. It never pays or books. Saved details and created logins are stored encrypted. Option 2 (their own computer) is promised for later.
- Ask the person only what is necessary: a name, a few lines about them, and which abilities to allow. Everything else has a default.

## Brand Commitments

- **Name:** Desker Personal. **Logo:** the current Desker artwork in `public/brand/`.
- **Sticky-note studio** (user decision, kept): ink blue #3558E6 for buttons and links; navy ink #1E2A45 on crisp white paper with a faint dot grid; soft sticky-note fills (lemon, sky, mint, coral, lilac) always under navy ink. Vivid yet calm: nothing neon, nothing brown.
- Voice: short, plain, no jargon, no filler.

## Evidence on Hand

No testimonials, usage numbers or press exist. Future work must not invent them.

## Product Principles

1. **Ask little.** Every field must earn its place; defaults do the rest.
2. **Plain words.** One idea per line, no product jargon.
3. **Trust through approval.** Anything outbound waits for a yes.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast gated by `npm run check:contrast`, visible focus ring, keyboard operation, reduced motion respected, 44px touch targets on phones.
