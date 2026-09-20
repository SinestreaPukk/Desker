# Desker

**Agentic AI Platform**

An agentic AI platform for building AI employees. Create agents with a name, a job title, a personality,
responsibilities, and your company's documents — then put them in front of real
clients through a shareable link or an embeddable chat widget. When a client
reports a bug, asks for a feature, or needs a human, the agent records it and it
lands in your inbox.

Everything here runs live against a real model API. There are no mocked replies,
no seeded fake conversations, and no buttons that do nothing.

> **Naming:** the product name and brand colour live in
> [`src/lib/brand.ts`](src/lib/brand.ts), and the logo is derived from the
> source artwork by `scripts/make-brand-assets.mjs`. "Roster" remains the name
> of the *page* that lists your AI staff — that is a feature, not the product.

---

## Quick start

### Option A — Docker (Postgres + pgvector)

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, then generate a session secret:
openssl rand -base64 32          # paste into AUTH_SECRET

docker compose up
```

Open <http://localhost:3000>, create an account, and you land in the agent
wizard.

Three services come up: `db` (Postgres with pgvector), `migrate` (applies the
schema, then exits), and `app` (waits for `migrate` to succeed). The app refuses
to start with a named list of what is missing rather than serving something that
500s on the first message.

The schema step is a separate container on purpose. The runtime image is a slim
standalone bundle without the Prisma CLI's dependency tree, and carrying that
tree just to run one command at boot roughly doubles the image.

#### Workspace-scoped keys

If `ANTHROPIC_API_KEY` is an **organisation-level** key rather than one scoped to
a single workspace, every request is rejected:

```
400 invalid_request_error — This API key is not scoped to a workspace, so this
request must include the anthropic-workspace-id header ...
```

Either create a key inside a workspace (Console → Settings → API keys, pick a
workspace) — the simpler option, nothing else to configure — or set
`ANTHROPIC_WORKSPACE_ID` to the workspace id from Console → Settings →
Workspaces. `/api/health` reports which of the two is in effect.

### Option B — Local Node, zero infrastructure (SQLite)

No Docker, no database server:

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY and AUTH_SECRET, then switch the datasource:
#   DATABASE_PROVIDER=sqlite
#   DATABASE_URL=file:./dev.db

npm install
npm run db:push      # generates the SQLite schema and creates the file
npm run db:seed      # optional: a demo admin, an agent, and a sample document
npm run dev
npm run inngest:dev  # in a second terminal: the background job runtime
```

The second terminal matters. Anything scheduled or event-driven runs through
[Inngest](https://www.inngest.com), and its dev server is what fires the
schedules locally (dashboard at <http://localhost:8288>). `/api/health` reports
`jobs.alive: false` until it has ticked once - see [Background jobs](#background-jobs).

`npm run db:seed` prints the demo login and writes
`samples/northwind-returns.md`, which you can upload to the seeded agent to see
grounded answers immediately.

### Required environment

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Server-side only. Never reaches the client bundle. |
| `ANTHROPIC_WORKSPACE_ID` | only for org keys | An organisation-level key is rejected with a 400 unless every request names a workspace. Leave blank for a workspace-scoped key. See [Workspace-scoped keys](#workspace-scoped-keys). |
| `AUTH_SECRET` | yes | Signs session cookies. `openssl rand -base64 32`. |
| `DATABASE_URL` | yes | Postgres connection string, or `file:./dev.db`. |
| `DATABASE_PROVIDER` | yes | `postgresql` or `sqlite`. Must match `DATABASE_URL`. |
| `NEXT_PUBLIC_APP_URL` | no | Used for share links; falls back to the request origin. |
| `ANTHROPIC_DEFAULT_MODEL` | no | Default `claude-sonnet-4-6`. |
| `EMBEDDING_PROVIDER` | no | `local` (default) or `openai` — see [Retrieval](#retrieval). |
| `OPENAI_API_KEY` | no | Needed for OpenAI-backed agents or OpenAI embeddings. |
| `NOTIFY_WEBHOOK_URLS` | no | Comma-separated webhooks notified on escalation or a high/critical issue. Slack's incoming-webhook format. |
| `CHAT_RATE_LIMIT` | no | Messages per client session per window. Default 20/min. |

`.env` is gitignored; `.env.example` is committed and is the canonical list.

---

## The five-minute path

1. **Sign up** — one workspace, no invitations to wait on.
2. **The wizard** asks three things: who the agent is (name, job title, team,
   a face), how it behaves (personality, opening message, and a plain-language
   escalation rule the model judges rather than keyword-matches), and whether
   it answers from context documents. A starter template pre-fills real prose
   so you are editing rather than staring at an empty textarea. The other
   tools - logging issues and suggestions, escalating, transferring - are on by
   default and adjusted in the editor.
3. **Upload a document** under *Company context*. It is chunked and indexed on
   the spot; the row shows Processing → Ready with a chunk count, and *Test
   retrieval* shows exactly what the agent will find.
4. **Try it** in the live preview, which runs the same code path a client hits.
5. **Publish.** The share panel gives you a link and an embed snippet.

---

## Projects

Every admin surface belongs to exactly one project — its own roster, inbox and
insights, with nothing shared between them. Use one per client or per product
line.

The scope lives in the **URL** (`/p/<slug>/roster`), not in a cookie: a link to a
conversation is then unambiguous, two projects can be open in two tabs, and
there is no hidden "current project" to fall out of sync with what is on screen.
Switching projects keeps you on the same tab, because comparing two inboxes is
the usual reason to switch at all.

Isolation is enforced server-side on every query, not just in the UI:

- an agent id from another project 404s rather than resolving
- `transfer_to_agent` can only reach colleagues in the same project — checked in
  the executor, not merely omitted from the prompt, since a model can name an id
  it was never given
- returning-client recall is scoped to the project too: one browser may have
  talked to two different clients' agents, and neither should learn about the
  other

## Organisations

Projects live inside an **organisation**, and an organisation is the security
and billing boundary between different customers of yours.

- Signing up creates a user, an organisation they own, and a first project, in
  one transaction. Nobody ever exists without an organisation.
- Access is a `Membership` row (`owner | admin | member`). Every project lookup
  is filtered through it, so a slug or id from another organisation is a 404,
  not a page, and the list endpoints (`/api/agents`, `/api/conversations`,
  `/api/issues`, `/api/analytics`) are bounded to the caller's organisations
  even when no project is named.
- A session whose user row is gone (a reset database) is treated as signed out
  rather than as an error - `currentUser()` in `lib/auth.ts` is the one check.

What is not built yet, on purpose: invites, roles beyond the owner who signed
up, and an organisation switcher. New projects go into the caller's oldest
organisation until then. The model does not change when those arrive.

### Upgrading an existing database

Two required foreign keys were added after the first release
(`Agent.projectId`, then `Project.organizationId`), and `db push` alone cannot
add a NOT NULL column to rows that already exist. `scripts/backfill-projects.mjs`
runs first (wired into `npm run db:push` and the `migrate` container), on both
Postgres and SQLite: it creates the missing tables, ensures a default project
and a default organisation, assigns existing rows to them, and makes every
pre-existing user an owner of that organisation - because before tenancy they
all shared one workspace. On a fresh database every step is a no-op.

## Autonomous work

An agent with a **scope of work** does things when nobody is talking to it.
The scope is a standing brief per agent - project context, objectives, the
documents it may search - plus a trigger: a cadence ("every Monday at 09:00,
Asia/Bangkok"), an inbound webhook (`POST /api/hooks/<token>` with any JSON),
or only by hand. The wizard's third step and the editor's *Scope of work*
panel edit the same record.

A run is an **action item** moving through a fixed state machine:

    queued -> in_progress -> done | failed | needs_approval
    needs_approval -> approved -> executing_external -> done | failed
    needs_approval -> rejected

`lib/work/runner.ts` owns the loop: it hands the model the tool set and
alternates model turns with tool calls until the model stops or the
iteration cap is hit. Every turn and every tool call is a durable Inngest
step, so a crash or a platform timeout resumes from the last completed step
instead of re-running (and re-billing) the whole task. The final assistant
message is the run's report; findings, draft ids and every tool call are
kept on the item.

The tool set (`lib/work/tools.ts`) is small and closed, and each tool declares
a risk level that the runner gates on:

| Tool | Risk | What it does |
|---|---|---|
| `search_context` | read | Retrieval over the scope's linked documents |
| `web_research` | read | Search (Brave, or Tavily), read the top pages, summarise with numbered sources; saved to the item. Results are cached by query for 6 hours across organisations; each call is metered per organisation |
| `draft_content` | draft | Writes a blog post, social caption or email into a `Draft`. Never publishes |
| `schedule_followup` | internal | Queues the next task as its own action item, now or after a delay, with this run's report as context |
| `escalate_to_human` | internal | Flags the run for a person - an issue in the Inbox - when the escalation rule applies or the work cannot be done safely |
| `publish_post` | external | Sends a draft to the organisation's publishing webhook |
| `send_email` | external | Sends through Resend |

Every agent starts in **draft-only** mode: `external` tools do not reach their
integration. The call is recorded as the item's `pendingAction`, the run ends
in `needs_approval`, and nothing goes out until a person approves it under
*Work*. Approval releases exactly that one action; rejection closes the item.
Moving an agent to auto mode is a field on the scope (`autonomy`), exposed in
the UI once the oversight layer exists.

Integrations live per organisation under *Integrations*: a generic webhook
(point Zapier, Make, or your own endpoint at it; deliveries are signed with
`X-Desker-Signature` when a secret is set) and a Resend email connector. Their
config is stored in plain text for now and is never returned to the browser,
logged, or written to an audit row; the credential vault replaces the store.

## Oversight

Nothing an agent does publicly happens without a visible, reviewable trail.

- **Inbox → Approvals** lists every action item in `needs_approval` with the
  post or email shown in full. An owner can approve, edit the draft and then
  approve, or reject with a reason; each decision is an audit row. The
  Approvals tab and the Work page share one card.
- **Inbox → Issues & suggestions** now carries what agents flag about
  themselves as well as what clients report: an escalation rule that fired
  during a run, or a run that failed. Agent-raised issues link to the run.
- **Trust** lives on the scope of work: an agent-wide mode (draft only /
  auto) plus a per-tool override for `publish_post` and `send_email`, so posts
  can flow while emails still wait. Every new agent starts draft-only.
- **The escalation rule covers action items.** The same plain-language rule
  written for conversations is given to the run prompt; the model judges it
  from what it encounters and calls `escalate_to_human`, which creates an
  issue and marks the run. Nothing is keyword-matched.
- **Audit log** (`/p/<slug>/audit`, `GET /api/audit`): every tool call an
  agent makes - in chat or at work - with its inputs, its result, and what
  triggered it, alongside every approval, rejection, draft edit, trust change
  and integration change. Filter by agent, actor, action and date; export the
  same rows as CSV. Rows are never edited or deleted.
- **Insights** adds task-level numbers next to the conversation ones: runs,
  completed vs failed vs awaiting approval, escalations, average approval
  turnaround, and tokens and cost per agent. Cost comes from `lib/pricing.ts`
  (first-party Anthropic list prices; `MODEL_PRICING_JSON` overrides or adds
  models) applied to the usage counters. An unpriced model shows as unknown,
  never as free - the figure is what billing will meter.

## Background jobs

Work that must happen without a browser tab open runs as
[Inngest](https://www.inngest.com) functions, registered in `lib/jobs/` and
served from `/api/inngest`. Nothing else talks to a scheduler or a queue.

- `heartbeat` - a cron that writes a `Heartbeat` row every minute in
  development (every five in production) and prunes rows older than a day.
  `/api/health` reports the newest tick under `jobs`, with `alive: false` once
  two intervals have passed without one. Point an uptime monitor at that field
  specifically - an agent that silently never runs is the worst failure this
  product can have.
- `scope-scheduler` - every minute, finds cron scopes whose latest fire time
  has not run and starts exactly one run each, deduplicated by
  `ActionItem.dedupeKey`. A missed minute is caught up on the next tick; an
  outage never replays every tick it missed.
- `action-item-run` - executes one action item as durable steps, waiting
  first if it is a follow-up scheduled for later.
- `action-item-execute-approved` - sends what a person approved.

Locally, `INNGEST_DEV=1` and `npm run inngest:dev`. In the compose stack an
`inngest` service does the same. In production, leave `INNGEST_DEV` unset and
set `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` from Inngest Cloud; the same
route serves both, and it registers itself under `NEXT_PUBLIC_APP_URL`.

## Metering and audit

Every model call - a chat turn, a summary, later an autonomous task - carries a
`billing` context (`organizationId`, optional `agentId`) that the provider seam
requires rather than accepts; a call with no tenant to bill does not typecheck.
After each API request the provider increments a `UsageCounter` row keyed by
organisation, UTC month, provider, model and agent, so a month total per
organisation and a per-agent breakdown come from the same table
(`usageForOrganization()` in `lib/usage.ts`). Web research is metered in the
same table under provider `search` (searches and pages read), so a plan quota
can cover both. Recording never fails a reply.

`AuditLog` records who did what to which thing: actor (`user | agent | system |
schedule`), a dotted action, a target, and metadata that must never contain a
secret. `audit()` in `lib/audit.ts` writes it and never throws. Sign-up and
project changes are recorded now; tool calls join them when agents start
acting on their own.

Every tool call an agent makes during a run is an `AuditLog` row
(`tool.called`, with the tool, its risk level, trimmed inputs and whether it
was gated), alongside `action_item.*` events for creation, completion,
approval and rejection.

## Architecture

One Next.js deployment. No microservices, no separate API server, no queue.

```
src/
  app/(admin)/p/[project]/ Admin dashboard — roster, inbox, insights, builder
  app/(auth)/…             Sign in / sign up
  app/c/[agentId]          Public client chat page
  app/embed/[agentId]      The document inside the widget iframe
  app/api/…                Route handlers (agents, chat, documents, issues, events)

  lib/llm/provider.ts      Provider-neutral chat seam (streamChat -> ChatEvent)
  lib/llm/anthropic.ts     Claude implementation
  lib/llm/openai.ts        OpenAI implementation, to keep the seam honest
  lib/agent-runtime.ts     One conversation turn: prompt, tools, streaming, persistence
  lib/agent-prompt.ts      System prompt assembly (pure, unit tested)
  lib/tools/               The fixed four-tool set and its executor
  lib/rag/                 Chunking, embeddings, hybrid retrieval
  lib/storage.ts           File storage interface (local disk; S3 driver stubbed)
  lib/notify.ts            Outbound webhooks for things that need a person
  lib/summarize.ts         Rolling summaries + returning-client recall
  lib/conversation.ts      Resolving which agent is answering after a transfer

public/embed.js            The widget loader third-party sites include
src-tauri/                 Desktop shell (Tauri 2)
public/brand/              Logo masks, generated from the source artwork
```

### The provider seam

`lib/llm/provider.ts` defines `streamChat(request): AsyncIterable<ChatEvent>`.
Both providers own their own agentic loop — the vendors' loop mechanics differ
enough that pretending otherwise would leak — and emit the same neutral events.
Switching an agent from Claude to GPT is one field, `Agent.modelProvider`.

The OpenAI implementation exists specifically so the abstraction cannot quietly
become an Anthropic-shaped interface. It is not at feature parity, on purpose.

### Retrieval

Hybrid: a keyword ranking fused with a vector ranking via reciprocal rank
fusion. Vector-only retrieval misses exact identifiers (SKUs, error codes,
policy numbers); keyword-only retrieval misses paraphrase.

- **Postgres** — pgvector for the vector half, `tsvector`/`ts_rank` for keywords.
- **SQLite** — the same two halves computed in process (cosine + BM25).

Nearest-neighbour search always returns *something*, so a chunk is only returned
if it matched on keywords or cleared a cosine floor. Ask a published agent about
the capital of France and it gets nothing back, and says so.

Two embedding backends:

| `EMBEDDING_PROVIDER` | What it does |
|---|---|
| `local` (default) | Deterministic hashed bag-of-words. No key, no network, no model download. Captures lexical overlap, not meaning — relevance is carried by the keyword half. |
| `openai` | `text-embedding-3-small`. Real paraphrase and synonym recall. Needs `OPENAI_API_KEY`. |

Anthropic does not serve an embeddings endpoint, which is why `local` is the
default: a Claude-only deployment should not need a second vendor to do RAG at
all. Set `openai` when recall matters more than dependency count.

### Human handoff

An escalation used to be a dead end: the agent could raise a hand, but nobody
could reply, so the client got "I've passed this to a colleague" and then
silence. A colleague can now type into the transcript from the inbox and it
lands in the client's chat window, attributed to them by name.

Replying takes the conversation over — `Conversation.replyMode` flips to
`human`, and the agent stops answering until it is handed back. The client's
messages are still recorded and still reach the inbox; they just are not
answered by an AI while a person is holding the conversation.

Delivery is an SSE feed that **tails the database**, not the in-process event
bus. The bus is faster, but the production bundle emits a copy of the module
into each route's chunk, so a publisher in one route reached no subscriber in
another — replies silently never arrived, with no error anywhere. Reading
committed rows is immune to that, survives more than one instance, and is the
same query a reload runs, so the live path and the reload path cannot disagree.

### Notifications

`NOTIFY_WEBHOOK_URLS` (comma-separated) receives a Slack-shaped payload when a
conversation escalates or a **high or critical** issue is logged, with a deep
link to the conversation. Lower severities are deliberately silent — logging
every cosmetic bug to a chat channel is how notifications get muted. Delivery is
best-effort with a 5s timeout: a broken webhook must never break a client's chat.

### Summaries and recall

A rolling summary is regenerated in the background once enough has been said to
change it (four messages), which keeps the inbox scannable without opening every
transcript. The same summaries are handed to an agent as recall when that client
returns, scoped to their session id — so a returning client is not a stranger.
Throttling is the design constraint: a summary per turn would roughly double
model spend.

### Client feedback

Every reply — from the agent or from a colleague — carries thumbs up/down for
the client. A rating is accepted only for a message inside that session's own
conversation. Insights shows satisfaction per agent and lists the replies
clients marked unhelpful with the question that prompted each, which is the
most direct list of what to fix after the content gaps.

### Private notes, search, duplication

- **Notes** on a conversation are team-only: never shown to the client, never
  replayed to the model.
- **Inbox search** matches transcripts and summaries.
- **Duplicate** copies an agent as a draft into any project, optionally with its
  indexed documents. Blobs are re-put under a new storage key rather than
  shared, so deleting one copy cannot take the other's file with it.
- **View system prompt** in the builder shows exactly what the runtime assembles
  from the saved configuration — the first thing to read when an agent behaves
  oddly.
- **Widget appearance** (label, colour, side) is saved on the agent and baked
  into the snippet the share panel emits.

### Routing between agents

`transfer_to_agent` lets a receptionist hand a client to the right specialist.
`Conversation.agentId` never moves — it is half the unique key and the client's
chat link points at it — so `activeAgentId` changes instead, and the client keeps
the same window and the same history.

### The tool set

Fixed at five. Admins choose which an agent may use; the permission is enforced
server-side, not just by omitting the definition, because a model can name a
tool it was never given.

| Tool | Effect |
|---|---|
| `search_company_context` | Hybrid search over that agent's documents |
| `log_issue` | Creates an `Issue` (with severity) on the conversation |
| `log_suggestion` | Creates a suggestion |
| `escalate_to_human` | Flags the conversation, files an escalation, and notifies |
| `transfer_to_agent` | Hands the conversation to another published agent |

Issues, suggestions and escalations appear on the dashboard the moment the tool
call commits, over an SSE feed, with polling as a backstop.

### The widget

`public/embed.js` is dependency-free, sets every style inline on its own two
elements, and puts the chat in an iframe — so a host page's CSS cannot break it,
it cannot leak styles into the host page, and the host page's scripts cannot
read the conversation. It is a floating panel on desktop and a full-screen sheet
under 640px, keyboard operable, and it closes on Escape from either side of the
frame boundary.

`/widget-demo.html?agent=AGENT_ID` is a plain HTML page for trying it against
something that knows nothing about Desker.

---

## Development

```bash
npm run dev              # dev server
npm run verify           # typecheck + lint + contrast audit + unit tests
npm test                 # unit tests (no key, no database)
npm run test:integration # live model + database (needs ANTHROPIC_API_KEY)
npm run test:e2e         # Playwright, desktop + mobile viewports
npm run check:contrast   # WCAG audit of the design tokens
npm run db:studio        # browse the database
```

### Branding

The logo is a single-colour **mask** (`public/brand/*.png`), painted by CSS with
the `--accent` design token rather than shipped as a light and a dark export.
One asset therefore renders correctly in both themes and the two can never drift
apart. Regenerate from the source artwork after changing it:

```bash
node scripts/make-brand-assets.mjs   # logo masks
node scripts/make-icon.mjs           # app icon, derived from the mark
npx tauri icon src-tauri/icons/icon.png
```

The brand indigo is `#1800AD`, taken from the artwork. It scores 12.8:1 on
white, but is far too dark to read on a dark ground, so the dark theme lifts it
to a periwinkle at the same hue (`oklch(0.72 0.17 268.5)`). Both are checked by
`npm run check:contrast`.

### Agent faces

Agents get a generated duotone face — an offset colour field with two eyes and
a mouth, in the "beam" idiom modern products settled on for generated avatars —
drawn as inline SVG in `src/components/agent-figure.tsx`. Every parameter is
derived from a seed, so an agent with no chosen face gets a stable one from its
id; the picker offers twelve looks per tone, stored as a short
`beam:<variant>:<tone>` key. The artwork follows the theme, stays crisp at any
size, and costs nothing to store.

The face is drawn in the tile's ground colour on the field colour, a pair that
is contrast-checked at 3:1 or better in both themes by `npm run check:contrast`.
Uploaded photos still take precedence.

### The lockfile

`package-lock.json` is resolved on **Linux**, not on a developer's macOS
machine. npm records only the optional platform variants it actually resolves,
and a macOS-resolved tree omits transitive dependencies of the wasm fallbacks
that npm selects on Linux — so `npm ci` inside the Docker build fails with
`Missing: @emnapi/... from lock file`. After changing dependencies, regenerate
it the same way:

```bash
docker run --rm -v "$PWD":/w -w /w node:22-slim \
  npm install --package-lock-only --no-audit --no-fund
```

`npm install` on macOS afterwards is fine; it adds the darwin binaries without
dropping the Linux ones.

### Switching database provider

`prisma/schema.prisma` is generated from `prisma/schema.template.prisma` so one
model set can target either engine — the pgvector column simply does not exist
on SQLite.

```bash
DATABASE_PROVIDER=sqlite npm run db:push
DATABASE_PROVIDER=postgresql npm run db:push
```

Never edit `prisma/schema.prisma` directly; edit the template.

### Tests

- **Unit** (`tests/unit`) — chunking, prompt assembly, BM25 and rank fusion,
  tool-call validation and permissions, rate limiting. No key needed.
- **Integration** (`tests/integration`) — against a real database.
  `tenancy.test.ts` needs only `DATABASE_URL`: organisations, the usage counter
  (including concurrent first writes to a new bucket) and the audit log.
  `agent-turn.test.ts` is a real streamed turn against a live Claude key that
  exercises retrieval and each tool, and asserts on the rows they leave
  behind; it skips itself with a warning when no key is present.
- **E2E** (`tests/e2e`) — signup, the wizard, upload and indexing, publish, the
  public link, the cross-origin widget, keyboard navigation, dark mode, and a
  360px viewport. Boots the production standalone build, not the dev server.

---

## Accessibility

Targeting WCAG 2.1 AA.

- `npm run check:contrast` parses the design tokens out of `globals.css`,
  converts oklch to sRGB, and checks every foreground/background pair the UI
  actually renders against its threshold in **both** themes. It exits non-zero
  on a failure and runs in CI.
- Every form control goes through one `Field` component that wires up the label,
  hint, and error with the right ARIA attributes, so a field cannot ship without
  an accessible name.
- Visible focus indicators everywhere, a skip link on every admin page,
  keyboard-operable widget, live regions on streaming replies, and
  `prefers-reduced-motion` respected.

Automated checks do not replace a manual pass with a screen reader.

---

## Deployment

The Docker image is the portable artifact — any container host runs it. It is
built on `node:22-slim` rather than Alpine: Prisma's query engine wants
glibc + openssl, and musl pulls in the wasm fallbacks described above.

### Vercel

Vercel runs `vercel-build` when it is present, and here it is
`npm run deploy:build`: generate the Postgres schema and client, run the
backfill, `prisma db push` (no `--accept-data-loss`, so a destructive change
fails the deploy rather than dropping a column), then `next build`.

1. Create a Postgres database with pgvector - Neon and Supabase both offer it -
   and take its connection string.
2. Import the repository into Vercel. Set the environment variables:
   `DATABASE_URL`, `DATABASE_PROVIDER=postgresql`, `ANTHROPIC_API_KEY`,
   `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `NEXT_PUBLIC_APP_URL` (the deployment's
   public origin), and `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` from an
   Inngest Cloud app.
3. Deploy. `GET /api/health` must return `ok: true` with `database: "up"`.
4. In Inngest Cloud, sync the app at `https://<your-domain>/api/inngest`. Within
   a few minutes `/api/health` reports `jobs.alive: true`.

Uploaded documents use the local-disk storage driver (`STORAGE_DIR`), which is
ephemeral on Vercel; swap the driver in `lib/storage.ts` for object storage
before relying on uploads there.

### Fly.io

```bash
fly launch --no-deploy                       # generates fly.toml from the Dockerfile
fly postgres create --name roster-db         # or bring your own Postgres
fly postgres attach roster-db                # sets DATABASE_URL

fly secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  AUTH_SECRET="$(openssl rand -base64 32)" \
  DATABASE_PROVIDER=postgresql \
  NEXT_PUBLIC_APP_URL=https://your-app.fly.dev

fly volumes create roster_storage --size 1   # uploaded documents
fly deploy
```

Add to `fly.toml` so uploaded documents survive a deploy:

```toml
[[mounts]]
  source = "roster_storage"
  destination = "/data/storage"
```

**pgvector:** run `CREATE EXTENSION IF NOT EXISTS vector;` once against the
database before the first deploy.

**Beyond one instance:** the SSE dashboard feed and the rate limiter are both
in-process. The dashboard degrades to its polling interval; the rate limit
becomes per-instance. Move both to Redis before scaling out.

**Storage:** the local-disk driver needs a persistent volume. For multiple
instances, implement the S3 driver in `lib/storage.ts` — the interface is
already the only thing the rest of the app talks to.

---

## Desktop (Tauri)

`src-tauri/` is a native shell for macOS and Windows around a running Desker
server — not a second frontend. It opens a connection screen, probes
`/api/health`, and navigates to the app once it answers.

```bash
rustup toolchain install stable   # one-time: Tauri needs a Rust toolchain
npm run desktop:dev               # run the shell
npm run desktop:build             # produce a .app/.dmg or .exe/.msi
```

Point it somewhere other than `http://localhost:3000` with the `ROSTER_URL`
environment variable, or from the connection screen itself.

A Tauri bundle can only be produced on its target OS, so both platforms are
built by the `desktop` matrix job in `.github/workflows/ci.yml`; artifacts are
attached to the run.

---

## Security notes

- Passwords are bcrypt hashed (cost 12). Login compares against a dummy hash
  when the account does not exist, so a missing account and a wrong password
  take the same time and return the same message.
- The API key is read server-side only and never logged.
- Uploads are checked for type and size (20 MB) before being read into memory;
  filenames are sanitised and storage keys cannot escape the storage root.
- The public chat endpoint is rate limited per agent + client session.
- Draft agents 404 on the public surface — the same response as a missing
  agent, so a link does not confirm a draft exists.
- A passcode-protected agent releases its transcript only to a request carrying
  the passcode, which travels in a header rather than a query string.
- Chat content is rendered as React text children throughout, including in the
  admin transcript. There is no HTML parsing path for client-supplied text, so
  stored XSS is structurally prevented rather than sanitised.

---

## Not built (deliberately)

Billing, invites and roles, voice channels, native mobile apps, an agent
marketplace, fine-tuning, and a drag-and-drop workflow builder. Agents call a
fixed set of tools - five in chat, six at work; letting admins define arbitrary
tools, or run code, is a different product.
