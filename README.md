# Desker Personal

Your own team of AI assistants for your own life: money, calendar, errands,
fitness, travel, learning. Talk to them on the web or in LINE, send them
photos (a bank slip, a poster, a letter), and they work out the trade-offs
across all of it. Nothing consequential happens without your explicit yes.

Personal-only: one person, one private space. There are no teams, invitations,
public chat links or business roles. Architecture and the decisions behind it:
[`docs/personal/ARCHITECTURE.md`](docs/personal/ARCHITECTURE.md).

## What is in it

- **Life context** (`src/lib/life/`): one shared, continuously updated picture of your calendar, money, tasks, goals, workouts and preferences that every assistant and the chat read from and write to.
- **Chat** (web and LINE): one front door that routes a message to a direct answer, one specialist, the cross-domain engine, a web-researched answer, or a reminder.
- **Reasoning engine** (`negotiate.ts`, `conflicts.ts`): checks an idea (a trip, a commitment) against budget, calendar, workouts and deadlines, lets the specialists weigh in, and returns a verdict with a cleaner alternative. A weekly digest does the same for the week as it stands.
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

`npm run verify` runs the duplicate-file check, typecheck, lint, the colour-contrast gate and the unit tests.

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

## Deploying

Vercel plus a Postgres database. The build applies the schema (`scripts/db-deploy.mjs`), which refuses a change that drops data unless `ALLOW_DESTRUCTIVE_MIGRATION=1`. Never deploy from a checkout linked to another Vercel project: pass `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` explicitly.

## Layout

```
src/app/            pages and API routes (Next.js App Router)
src/lib/life/       life context, router, negotiation, reminders, alerts, slips, research
src/lib/work/       the shared agent runtime: tools, approval gate, runner
src/lib/messaging/  LINE, Telegram, WhatsApp and friends
src/lib/integrations/  OAuth connectors, calendar, tasks, phone
prisma/             schema.template.prisma is the source; schema.prisma is generated
content/            site copy and the assistant role templates
```
