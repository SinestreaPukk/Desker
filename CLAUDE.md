@AGENTS.md

# Engineering rules (keep the product to an industrial standard as code changes)

Run `npm run verify` before every commit; CI runs the same checks. It fails when the docs and code drift.

- **Prompts** (`src/lib/agents/agent-prompt.ts`, `team.ts`, `agent-runtime.ts`, `work/prompt.ts`, `life/research.ts`): read `docs/PROMPTS.md` first. Keep anything that changes per call out of the stable part (it is cached). Change a prompt together with its test and `docs/PROMPTS.md`.
- **New subsystem** under `src/lib/`: add it to the subsystem map in `docs/ARCHITECTURE.md` (`npm run check:docs` enforces it).
- **New environment variable**: add it to `.env.example` and, for production, to Vercel.
- **New or changed behaviour**: add or update a unit test in `tests/unit/`; nothing that touches approvals, auth, money or the browser ships without one.
- **UI**: follow `DESIGN.md` and the type and radius scale; update `PRODUCT.md` when a screen is added or removed.
- **Performance**: no database write on a hot path (API middleware, chat polling); no per-request lookups repeated across a layout and its page (use the per-request cache); stable-first prompts.
- **Deploy**: after a deploy, confirm `/api/inngest` answers 401 and the health heartbeat is alive.
