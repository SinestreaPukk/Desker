# Desker Personal

Your own AI assistant for your own life: money, calendar, errands,
fitness, travel, learning. Talk to them on the web or in LINE, send them
photos (a bank slip, a poster, a letter), and they work out the trade-offs
across all of it. Nothing consequential happens without your explicit yes.

Personal-only: one person, one private space, one assistant that you configure
(persona, tools, model, schedule, knowledge). There are no teams, invitations,
public chat links, business roles or billing. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the architecture and product decisions.

## The interface

Three screens, nothing else:

1. **Agent** (`/p/<space>/agent`): the settings of the one assistant: profile, responsibilities, tools, model, schedule, documents and rules, plus *About you*. The assistant keeps *About you* current as you talk to it (`src/lib/agents/learn.ts`); every change is visible and editable there.
2. **Integrations**: connect LINE, Telegram, WhatsApp, Gmail, calendars, Slack and the rest, and choose what reaches you there (alerts, morning brief, news).
3. **Productivity**: intentionally blank for now.

Chat happens in the messaging apps you connect, and anything that needs your yes arrives there as an approval card.

## What is in it

- **Life context** (`src/lib/life/`): one shared, continuously updated picture of your calendar, money, tasks, goals, workouts and preferences that the assistant and the chat read from and write to.
- **Chat** (web and LINE): one assistant; a message is answered directly, weighed across your whole life by the cross-domain engine, researched on the web, or turned into a reminder.
- **Reasoning engine** (`negotiate.ts`, `conflicts.ts`): checks an idea (a trip, a commitment) against budget, calendar, workouts and deadlines, weighs each affected area, and returns a verdict with a cleaner alternative. A weekly digest does the same for the week as it stands.
- **Money**: slips, bills, invoices and bank CSVs become ledger entries; the Money page shows the trend, odd charges and bills at risk, all computed in code.
- **Integrations**: Google and Outlook calendar and mail, Google Tasks and Microsoft To Do, Slack, Twilio (texts, call screening, calls), LINE and other messaging apps.
- **Approval-first**: sending, posting, calendar changes, texts and calls all stop for your OK (`src/lib/work/decide.ts`), on the web or as a LINE card.

## Run it locally

```bash
npm install
cp .env.example .env.local      # set ANTHROPIC_API_KEY, DATABASE_URL, AUTH_SECRET, VAULT_KEY
npm run db:push                 # SQLite by default; Postgres when DATABASE_PROVIDER=postgresql
npm run dev                     # http://localhost:3000
npm run inngest:dev             # background jobs: reminders, alerts, digests, runs
```

`npm run verify` runs the duplicate-file check, typecheck, lint, the colour-contrast gate and the unit tests. Integration tests (`npm run test:integration`) need a database; end-to-end tests are `npm run test:e2e`.

The Prisma schema is generated: `prisma/schema.template.prisma` is the source, `prisma/schema.prisma` is gitignored. Run `npm run db:generate` after a fresh clone and after editing the template.

## Configuration

Everything is an environment variable; `.env.example` lists them with comments. The ones that matter first:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` if the key is not workspace-scoped) | The model |
| `DATABASE_URL`, `DATABASE_PROVIDER` | SQLite locally, Postgres with pgvector in production |
| `AUTH_SECRET`, `VAULT_KEY` | Sessions; encryption of stored integration secrets (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS address (LINE, Twilio and OAuth call back to it) |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_APP_ID` | Background jobs in production |
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_BOT_ID` | The LINE account; `LINE_LOGIN_CHANNEL_ID` and `NEXT_PUBLIC_LIFF_ID` for the mini-app views |
| `BRAVE_SEARCH_API_KEY` | Web research in chat |
| `GOOGLE_*`, `SLACK_*`, `MICROSOFT_*` | OAuth connectors |

## LINE

Webhook URL `https://<your-domain>/api/messaging/line`. Link your account from **Alerts**. `npm run line:richmenu` installs the rich menu. Photos you send are read; bank slips and bills go to Money.

## Layout

```
src/app/                 pages and API routes (Next.js App Router)
src/components/          React components by area (ui, builder, work, chat, marketing ...)
src/hooks/               client data hooks (React Query)
src/lib/
  auth/                  sessions, sign-in guard, password reset, bot check, vault
  tenancy/               organisation, project and space model, account export/delete
  agents/                the assistant: prompt, runtime, team chat, first run
  platform/              db, env, storage, audit, usage, rate limits, monitoring, API helpers
  site/                  public-site content, blog, guides, legal, brand
  shared/                small helpers used on both server and client
  life/                  life context, router, negotiation, reminders, alerts, research
  work/                  the agent runtime: tools, approval gate, runner, watchdog
  integrations/          OAuth connectors, calendar, mail, tasks, phone, social
  messaging/             LINE, Telegram, WhatsApp, Slack, Discord, Teams
  jobs/  llm/  rag/  money/  tools/
content/                 site copy, blog posts, guides and the assistant template
prisma/                  schema.template.prisma (source), seed
scripts/db/              schema generation, deploy-time migration, data fixes
scripts/ops/             env push, security and contrast checks, LINE rich menu
tests/{unit,integration,e2e}
docs/                    architecture notes
```


```
src/app/            pages and API routes (Next.js App Router)
src/lib/life/       life context, router, negotiation, reminders, alerts, slips, research
src/lib/work/       the shared agent runtime: tools, approval gate, runner
src/lib/messaging/  LINE, Telegram, WhatsApp and friends
src/lib/integrations/  OAuth connectors, calendar, tasks, phone
prisma/             schema.template.prisma is the source; schema.prisma is generated
content/            site copy and the assistant role templates
```
