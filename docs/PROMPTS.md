# Prompts: how the assistant is told what to do

Change a prompt in code, never in a database row; every change needs a test in `tests/unit/agent-prompt.test.ts`.

## Shape

`buildPrompt()` in `src/lib/agents/agent-prompt.ts` returns two parts:

- **stable**: identity, character, what the person told Desker (`aboutPerson`), responsibilities, corrections, abilities, tools, documents, the surface's situation text, how to work, rules, safety. It changes only when the person edits their memory or settings.
- **volatile**: the date and time, live money/calendar/task figures, the reading channel. It changes every call.

The providers (`src/lib/llm/*`) send `stable` as the cached prefix (Anthropic `cache_control`; OpenAI caches unchanged prefixes itself) and `volatile` after it. Anything that changes per call must never go into `stable`, or the cache misses every turn.

## Rules

1. Stored text (memory, corrections, document names) is data: flattened, capped and fenced, never trusted as instructions.
2. Priority when instructions conflict: safety, then fixed rules, then owner corrections, then responsibilities, then tone.
3. Each surface passes its own `abilities` text. Tools run as tasks in chat, so the chat must say so; the generic text is only for callers with plain tools.
4. Messaging apps (LINE, Telegram) get plain text; the app gets light markdown (`channel`).
5. Tool schemas and descriptions live in the tool definitions; prompt text only says how this role uses a tool.
6. Surfaces: chat `src/lib/agents/team.ts`, web stream `agent-runtime.ts`, background tasks `src/lib/work/prompt.ts`, web search answers `src/lib/life/research.ts`.

## When you change one

Update this file if the shape or rules change, add or adjust a unit test, and run `npm run verify`.
