# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small-business owners and founders: solo founders, freelancers and small teams who "hire" AI employees to take on research, content, customer support and admin. They check in a few times a day rather than living in the app: to see what their staff did, to approve what is about to go out, and to hand over new work.

## Product Purpose

Desker lets a small business run a team of AI employees. Each employee has a role, a scope of work and a schedule; it does the work on its own, reports back, and asks before anything leaves the building. Success is an owner who spends minutes a day in Desker and gets hours of work done, trusting what went out because they approved it.

## Positioning

- **They work on their own.** Agents run on a schedule, a webhook or a manual start with nobody watching, and report back like staff.
- **Nothing goes out unapproved.** Everything is a draft by default; posts and emails wait for the owner's yes.
- **A team, not a single bot.** Agents have roles and hand work to each other (a researcher briefs a writer), and the owner sees the collaboration.

## Operating Context

- The owner's day: open the app, read what was done (Work, Inbox updates), approve or reject what is waiting, review suggestions, adjust an employee's scope.
- Surfaces: Roster (the staff), agent editor (profile, knowledge, work and schedule), Work (runs: active and finished, each with its own report page), Inbox (conversations, approvals, issues, suggestions, updates), Insights, Integrations, Audit log, Organisation.
- Clients also meet the agents through a public chat link or an embeddable widget.
- A public marketing site sells the product.

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind 4, Radix primitives, Prisma on SQLite (local) and Postgres (production), Inngest for background work, Auth.js credentials.
- Light and dark themes; every colour pair is gated at WCAG 4.5:1 by `npm run check:contrast`.
- Multi-tenant: organisations, projects, roles and invitations.
- Integrations: Google Calendar, Slack and GitHub via OAuth (apps not yet registered), publishing webhooks, Resend email.

## Brand Commitments

- **Name:** Desker.
- **Logo:** the current Desker logo artwork (`public/brand/`), kept as is.
- **Brand colour:** the logo indigo, #1800AD, stays the brand colour.
- Not binding (open to change in a redesign): the landing page's night-sky world, the drawn agent figures, the rest of the palette and the typography.

## Evidence on Hand

- Real product content: seeded demo organisation (Northwind) and live runs, research findings, drafts and suggestions in the development database.
- No customer testimonials, logos, case studies, usage numbers or press exist. Future work must not invent them.

## Product Principles

1. **Minutes, not hours.** The owner checks in briefly; what needs them must be obvious at a glance.
2. **Trust through approval.** Anything leaving the building is visible, reviewable and reversible before it goes.
3. **Staff, not software.** Agents are presented as employees with roles, work and reports, not as bots or pipelines.
4. **Show the work.** Every run can be opened and read: what happened, what it found, what it drafted.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast gated in CI, a visible focus ring everywhere, keyboard operation, reduced motion and reduced transparency respected, 44px touch targets on phones.
