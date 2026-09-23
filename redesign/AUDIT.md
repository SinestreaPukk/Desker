# Phase 0 — Audit (no code changes)

Captured 2026-09-23 against `next dev` on :3000. Screenshots: `redesign/before/`
(re-run with `node redesign/screens.mjs after` in Phase 5 for the same set).

## 1. Where things live

| Concern | File |
|---|---|
| Design tokens (light + dark), Tailwind v4 `@theme inline`, type/radius/shadow scales, landing CSS (`.sky`, `.glass`, `.mat`, `.window`, clouds, sun) | `src/app/globals.css` (single source; there is no `tailwind.config`) |
| Landing page (all sections, pricing cards inline) | `src/app/(marketing)/page.tsx` |
| Nav + footer shell | `src/app/(marketing)/layout.tsx`, `components/marketing/site-header.tsx` (frost on scroll — already sticky/blurred), `site-nav.tsx` |
| Hero demo (5 tabbed scenes) + `Frame` + all scene components | `components/marketing/hero-stage.tsx` |
| Roles bento, FAQ (`<details>`), clouds, horizon SVG | `components/marketing/landing-blocks.tsx` |
| Primary landing CTA (glass gradient button) | `components/marketing/glass-button.tsx` |
| Scroll reveal (lazy Motion, reduced-motion aware) | `components/marketing/reveal.tsx`, `motion-lazy.tsx` |
| Copy | `content/landing.json`, `content/site.json` (nav/footer), `content/templates.json` (8 roles), `content/showcase.json` — all validated by zod in `src/lib/content.ts` |
| Plans / prices / limits | `src/lib/billing/plans.ts` (`PLAN_IDS` drives Stripe + DB, not just marketing) |
| Contrast gate | `scripts/check-contrast.mjs` (already in `npm run verify`) |
| Live token/contrast page | `/design-system` → `src/app/(admin)/design-system/design-system.tsx` |
| Theme | `components/providers.tsx` — **public site is forced light**; app follows OS (light/dark) |
| Shared UI | `components/ui/{button,badge,panel,tabs,dialog,states,...}.tsx` — landing and app already share these |
| Emails | Plain text only (`lib/invites.ts`, `api/contact/route.ts`, digests). No HTML templates to theme. |

Landing section order today: Hero (+ 5-scene demo) → "How scheduled agents work" (6 cards, each with a finished demo frame) → Roles bento (8) → Pricing (3) → FAQ (6) → Final CTA → Footer (2 link columns).

**Duplication is bigger than Ada:** all five hero scenes (Mia, Nova, Sol, Ada, Kai) are rendered a second time, finished, in the six feature cards below. Only the Approvals scene is unique to that section.

## 2. Token usage (occurrences / files, `src/`)

| Token | Uses | Files | | Token | Uses | Files |
|---|---:|---:|---|---|---:|---:|
| accent | 91 | 41 | | positive | 22 | 11 |
| accent-soft | 36 | 22 | | warning | 15 | 8 |
| accent-line | 28 | 19 | | danger | 43 | 21 |
| accent-soft-fg | 24 | 15 | | sky-ink | 16 | 7 |
| accent-fg | 13 | 10 | | sky-pale | 6 | 1 |
| accent-hover | 7 | 5 | | sky / sky-deep | 4 / 4 | 1 |
| focus | 2 | 2 | | sky-glass(-deep) / sky-shadow | 4 / 3 | 2 |
| av-1…6 (bg/fg) | 4 each | — | | | | |

Heaviest accent consumers: new-agent wizard (14), landing-blocks (12), admin-shell (11), hero-stage (11), landing page (9), insights (8), organization (7), showcase (7), scope-of-work form (7).

## 3. Hard-coded colours that bypass tokens

| Where | What | Action in Phase 1 |
|---|---|---|
| `app/layout.tsx:36-37` | `themeColor` `#fafaff` / `#141319` | Match `--paper` light/dark |
| `app/opengraph-image.tsx:21-38` | `#fafaff`, `#ecebff`, `#1a1a2e`, `#4a4a63`, `#7a7a90`, `BRAND.color` | OG images can't read CSS vars → move to a shared hex constant derived from tokens |
| `components/marketing/landing-blocks.tsx:41-50` | 6 `oklch()` stops in the Horizon SVG | Tokenise as `--horizon-*` (or derive from `--sky*`) |
| `components/ui/panel.tsx:13`, `ui/dialog.tsx:28`, `app/c/[agentId]/page.tsx:42` | Arbitrary `shadow-[…oklch(0 0 0/…)]` | Use `--shadow-*` scale (they bypass the brand-tinted shadow) |
| `ui/button.tsx:18,24`, `ui/panel.tsx`, `ui/dialog.tsx`, `c/[agentId]` | `ring-white/…`, `text-white` | `text-white` → an on-colour token; ring highlights can stay (they're alpha sheen, not a hue) |
| `admin-shell.tsx:145`, `hero-stage.tsx:343,624` | `text-white` | On-colour token |
| `ui/switch.tsx:22`, `ui/dialog.tsx:20` | `bg-white` thumb, `bg-black/45` scrim | Acceptable (neutral), or `--surface` / `--scrim` |
| `agent-figure.tsx:133` | `fill="#fff"` (mask) | SVG mask — leave (not a visible colour) |
| `lib/brand.ts:17` | `BRAND.color = "#1800AD"` | Keep as the literal reference; it's the widget launcher default |
| `public/embed.js:60-139` | `#1800AD` default, `#fff`, `rgba(0,0,0,…)` shadows | Runs on customer sites, can't read our vars → keep literals, sync with BRAND |
| `public/widget-demo.html` | old warm "clay" palette (`#fbfaf8`, `#eee9e3`, `#1a1917`) | Stale demo page — retheme or leave |
| `globals.css:527-536` | `#000` in `mask-image` | Masks, not colour — leave |
| `design-system.tsx:82` | `#000` canvas probe | Leave |

No Tailwind default-palette hues (`blue-500` etc.) anywhere — only white/black.

## 4. What will break if tokens change

1. **Contrast script only parses `oklch(L C H)`** inside `:root {` and `:root.dark {`. New ember tokens must be written in oklch (or the parser extended for hex), and ember pairs added to its list, or they're silently unchecked.
2. **`/design-system` has its own hard-coded token + pair list** — must be updated alongside.
3. **`Button variant="primary"` = `bg-accent` is the primary action on every app screen** (Save, Publish, Approve and send, Run…). Switching `primary` to ember would put ember on dozens of buttons per session — breaks the 10% rule. Ember needs its own variant (e.g. `cta`) used deliberately.
4. **Hero white-text contrast was tuned by gradient stop positions** (`.sky`, `.sky-band`). Any change to `--sky-deep` has to re-clear 4.5:1 at 390/768/1440.
5. **`GLASS_BUTTON`** is the CTA in the header, hero, final CTA and showcase — one change moves four places.
6. **`warning` vs ember:** "Needs approval" uses `tone="warning"` (amber-brown, hue 75). The Approve moment will put ember *next to* that badge — this is the exact spot where they'll look alike.
7. **`--av-4`** is orange (hue 55–62) — same family as ember (~hue 40). Needs to move.
8. **Badge `tone="accent"`** is reused for statuses Open / Running / Approved / Sending / Owner — those should stay indigo.
9. **Content schema** (`lib/content.ts`): headline max 60 chars, `features.items[].demo` enum, max 8 items, meta title ≤ 70. The new sections need schema changes; the brief's `content/landing.ts` would replace the JSON+zod setup.
10. **e2e `tests/e2e/site.spec.ts`** asserts the H1 equals `landing.hero.headline` and clicks `faq.items[1]` — reads from content, so it survives rewrites as long as the structure holds.
11. **`PLAN_IDS`** feeds Stripe checkout and the billing page. Enterprise must be marketing-only, not a new plan id. There are only monthly Stripe prices (`STRIPE_PRICE_STARTER/GROWTH`), so an annual toggle has nothing to check out against yet.
12. **Type scale is locked** (`--text-*: initial`): any new size (e.g. a stat number) must be added to the scale or it silently doesn't exist.

## 5. Claims on the current page that need checking (for Phase 3)

- FAQ: "documents are encrypted at rest and transmitted using zero-retention enterprise endpoints." The code encrypts **integration credentials** (AES-256-GCM, `lib/vault.ts`). Uploaded documents aren't app-encrypted, and I found nothing in the code for zero-retention. → TODO for you to confirm, or I'll soften it.
- Integrations that actually exist: email sending via Resend, Slack/webhook **notifications**, inbound webhooks, hosted chat link + embed widget. **No** Gmail, LinkedIn or Slack posting. The new FAQ answer has to say that.
- Languages: nothing explicit in code → TODO.
- Pricing footnote "unlimited teammates, email support": no plan limit on seats exists in `PlanLimits`, so "unlimited teammates" holds; support level is a business claim → confirm.

## 6. Screenshots (`redesign/before/`)

landing-1440, landing-390 (full page) · showcase-1440 · login-1440/390 · app-roster, app-work-approvals (+ dark), app-inbox, app-insights, app-agent-builder, app-client-chat (1440 + 390).

The app screens are from the local seed account (`admin@example.com`). Its Work page is empty, so there is no live approval card in the "before" set.
