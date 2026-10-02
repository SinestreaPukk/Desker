# Desker Personal: architecture and decisions

Standalone, personal-only product. One person, one space, no business concept anywhere a user can see or reach.
Decisions below were settled with Tiger on 2026-10-02.

## Decisions

| Question | Decision | Trade-off |
|---|---|---|
| Name | **Desker Personal** (`BRAND` in `src/lib/brand.ts`) | Keeps the family tie to Desker; revisit if it must stand fully alone. |
| Shared vs duplicated backend | **One repo, one backend.** Share the runtime; fork only frontend, onboarding and personal-life schema. | Cheapest, no drift in the trust layer. Cost: the business app can no longer ship from this branch, so it lives on `main`, and shared fixes are cherry-picked either way. |
| Fitness | **Its own named agent (Coach).** | Cleaner mental model, and the reasoning engine needs a distinct fitness voice to trade off against calendar and travel. Cost: one more specialist prompt, tool set and test to maintain. |
| Telephone | **All of it:** voice calls, SMS, call screening. Shipped in that order of risk: SMS, then screening, then outbound voice. | Each is its own connector with its own consent/approval rules; outbound voice and SMS are `external` risk and always wait for a yes. |
| "Meowjot format" | KBTG money app: scans the photo gallery for bank slips and books them as accounting entries. Bills/invoices/slips become structured ledger entries (payee, amount, date, category, source image) with visual summaries. | Needs gallery/photo upload plus slip OCR; a user-selected folder/upload, never silent background scanning. |

## Subsystem map

| Subsystem | Status | Where |
|---|---|---|
| Agent runtime / orchestration (runner, tools, gating, Inngest jobs) | **Shared, unchanged** | `src/lib/work/*`, `src/lib/jobs/*`, `src/lib/agent-runtime.ts` |
| Approval-first trust layer (`WORK_TOOL_RISK`, drafts, Needs you, audit) | **Shared, a constraint on everything below** | `src/lib/work/tools.ts`, `src/lib/audit.ts` |
| Document grounding (RAG) | **Shared** | `src/lib/rag/*` |
| Integration framework (OAuth, vault, catalog) | **Shared**, new connectors added | `src/lib/integrations/*` |
| Auth, rate limits, billing | **Shared** | `src/lib/auth.ts`, `src/lib/billing/*` |
| Messaging (LINE/WhatsApp/Telegram...) | **Shared transport**, LINE promoted to first-class (Phase 6) | `src/lib/messaging/*` |
| Frontend, onboarding, marketing site | **Forked / personal-only** | `src/app/*`, `content/*` |
| Space model (`Organization.kind`, `User.useType`, business roles, support inbox, widget, public chat) | **Removed** | schema, `space.ts` |
| Life-context layer | **New** (Phase 1) | `src/lib/life/*`, `Life*` models |
| Router, reasoning/negotiation engine, digest | **New** (Phases 2-3) | `src/lib/life/router.ts`, `src/lib/life/negotiate.ts` |

Internally the tenancy rows (Organization/Project) stay as an invisible container so the shared runtime keeps working; nothing user-facing names them.

## Trust rule every phase builds inside

Anything with risk `external` (send, create/move/cancel calendar entries, reply, call, text, pay) stops for explicit approval. The chat, the router and the reasoning engine may *propose* and *draft*; only the existing approval path executes. Nothing in Phases 1-7 adds a bypass.
