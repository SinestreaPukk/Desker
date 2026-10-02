# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One audience: individuals who want private AI assistants for their own life, reached on the web and in LINE. They check in a few times a day rather than living in the app: to see what was done, approve what is about to go out, and hand over new things. There is no business product, no teams and no clients.

## Product Purpose

Desker Personal gives a person a small team of assistants (money, life admin, fitness, travel, learning and more) that share one picture of their life, weigh trade-offs across it, and ask before anything leaves the building. Success is a person who spends minutes a day, trusts what went out because they approved it, and is told about the budget clash before it happens.

## Positioning

- **One shared life context.** Calendar, money, tasks, goals and workouts in one place that every assistant reads and writes.
- **Judgement across domains.** A trip is checked against the budget, the calendar, the workouts and the deadlines at once, not by six separate bots.
- **Numbers computed, not guessed.** Totals, budgets and conflicts are worked out in code; account numbers are masked before any model reads a statement.
- **Nothing goes out unapproved.** Sends, posts, calendar changes, texts and calls wait for your yes, on the web or as a card in LINE.
- **Your data is yours.** Download everything or delete the account from Your space.
- **Private by construction.** One member per space, no invitations, no public links (enforced server-side).

## Operating Context

- The day: open the app or LINE, read what was done, approve or reject what is waiting, ask for something new.
- Surfaces: Needs you (the one action queue), Roster (the assistants), Chat (one thread across web and messaging apps), Money, Work (runs and reports), Workflows, Alerts, Integrations, Your space, Audit log.
- A public marketing site sells the product.

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind 4, Radix primitives, Prisma on SQLite (local) and Postgres (production), Inngest for background work, Auth.js credentials.
- Light theme; every colour pair is gated at WCAG 4.5:1 by `npm run check:contrast`.
- Integrations: Google and Outlook calendar and mail, Google Tasks, Microsoft To Do, Slack, Twilio, LINE and other messaging apps.

## Brand Commitments

- **Name:** Desker Personal.
- **Logo:** the current Desker logo artwork (`public/brand/`), kept as is.
- **Brand colour:** the sticky-note studio (user decision, 2026-09-28): a clear ink blue #3558E6 for the logo, app icon, buttons and links; navy ink #1E2A45 on crisp white paper with a faint dot grid; soft sticky-note fills (lemon, sky, mint, coral, lilac) always under navy ink. Vivid yet calm: nothing neon, nothing brown.
- Not binding (open to change in a redesign): the landing page's night-sky world, the drawn agent figures, the rest of the palette and the typography.

## Evidence on Hand

- Real product content: live runs, research findings, drafts and suggestions in the development database.
- No customer testimonials, logos, case studies, usage numbers or press exist. Future work must not invent them.

## Product Principles

1. **Minutes, not hours.** The owner checks in briefly; what needs them must be obvious at a glance.
2. **Trust through approval.** Anything leaving the building is visible, reviewable and reversible before it goes.
3. **Assistants, not software.** Assistants have a role, work and reports, not a pipeline to configure.
4. **Show the work.** Every run can be opened and read: what happened, what it found, what it drafted.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast gated in CI, a visible focus ring everywhere, keyboard operation, reduced motion and reduced transparency respected, 44px touch targets on phones.
