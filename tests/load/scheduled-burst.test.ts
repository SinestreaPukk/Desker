/**
 * The worst realistic morning: every organisation's "weekdays at 9am" agents
 * firing in the same tick, each doing the multi-step tool work a real run does
 * (Bright's competitor scan was seven tool calls).
 *
 * Real database, real scheduler claim, real runner, real tools. Two stand-ins:
 * the model (a scripted provider with realistic latency, so the numbers mean
 * something without spending credits) and the job runtime (a local queue
 * enforcing the same limits as production - WORK_MAX_CONCURRENT_RUNS across
 * the platform, 3 per organisation, 25 concurrent run starts).
 *
 * It reports how long the scheduler's claim takes, how fast runs start, how
 * deep the queue gets, and how long the burst takes to drain - and fails if
 * any run is lost or the numbers blow past their budgets.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const ORGS = Number(process.env.LOAD_ORGS ?? 100);
const AGENTS_PER_ORG = Number(process.env.LOAD_AGENTS_PER_ORG ?? 3);
const TOOL_CALLS_PER_RUN = 7;
const MODEL_LATENCY_MS = Number(process.env.LOAD_MODEL_LATENCY_MS ?? 400);

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));
vi.mock("@/lib/notify", () => ({ notifyInBackground: () => {}, notify: async () => undefined }));

// A scripted model: search, draft, search... then a report. Latency jittered
// around MODEL_LATENCY_MS per turn, usage recorded like the real provider.
vi.mock("@/lib/llm/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm/provider")>();
  const { recordTokenUsage } = await import("@/lib/usage");
  const fake = {
    id: "anthropic",
    defaultModel: "load-test",
    streamChat: () => {
      throw new Error("not used");
    },
    complete: async (request: import("@/lib/llm/provider").CompleteRequest) => {
      await new Promise((r) => setTimeout(r, MODEL_LATENCY_MS * (0.5 + Math.random())));
      const turns = request.messages.filter((m) => m.role === "assistant").length;
      if (request.billing) {
        await recordTokenUsage({ ...request.billing, provider: "anthropic", model: "load-test", inputTokens: 3000, outputTokens: 300 });
      }
      const usage = { inputTokens: 3000, outputTokens: 300 };
      if (!request.tools?.length) {
        return { message: { role: "assistant" as const, content: '{"headline":"Load test run","summary":"Done."}' }, stopReason: "end_turn", usage };
      }
      if (turns >= TOOL_CALLS_PER_RUN) {
        return { message: { role: "assistant" as const, content: "Report: scanned, drafted, done." }, stopReason: "end_turn", usage };
      }
      const call =
        turns % 2 === 0
          ? { id: `c${turns}`, name: "search_documents", input: { query: "competitor pricing" } }
          : { id: `c${turns}`, name: "draft_content", input: { kind: "social_caption", title: `Draft ${turns}`, body: "A short caption." } };
      return { message: { role: "assistant" as const, content: "", toolCalls: [call] }, stopReason: "tool_use", usage };
    },
  };
  return { ...actual, getProvider: async () => fake };
});

import { claimDueScopes, fireScope, type DueScope } from "@/lib/work/scope";
import { runActionItem, inlineSteps } from "@/lib/work/runner";
import { env } from "@/lib/env";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const orgIds: string[] = [];

/** Runs `tasks` with at most `limit` in flight, the way a concurrency key does. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

const pct = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

beforeAll(async () => {
  const created = new Date(Date.now() - 24 * 60 * 60_000);
  for (let o = 0; o < ORGS; o++) {
    const org = await prisma.organization.create({
      data: {
        name: `Load ${stamp} ${o}`,
        slug: `load-${stamp}-${o}`,
        plan: "growth",
        projects: {
          create: {
            name: "Load",
            slug: `load-${stamp}-${o}`,
            context: "The business: a load test.",
            contextAnswers: { business: "A load test.", audience: "Nobody.", tone: "Plain.", never: "Nothing." },
          },
        },
      },
      include: { projects: true },
    });
    orgIds.push(org.id);
    await Promise.all(
      Array.from({ length: AGENTS_PER_ORG }, (_, a) =>
        prisma.agent.create({
          data: {
            projectId: org.projects[0]!.id,
            name: `Agent ${a}`,
            jobTitle: "Research Analyst",
            personality: "Plain and brief.",
            responsibilities: [],
            allowedTools: [],
            status: "published",
            scopeOfWork: {
              create: {
                objectives: ["Scan competitors and draft one caption"],
                documentIds: [],
                triggerType: "cron",
                cron: "* * * * *",
                tools: ["search_documents", "draft_content", "suggest_opportunity"],
                contextAnswers: { project: "Weekly competitor scan." },
                createdAt: created,
              },
            },
          },
        }),
      ),
    );
  }
});

afterAll(async () => {
  for (const id of orgIds) await prisma.organization.delete({ where: { id } }).catch(() => {});
  await prisma.$disconnect();
});

describe(`${ORGS} organisations x ${AGENTS_PER_ORG} agents, all due in one tick`, () => {
  it("claims, starts and drains the burst without losing a run", async () => {
    const total = ORGS * AGENTS_PER_ORG;
    const mine = new Set(orgIds);

    // 1. The scheduler tick: claim everything due.
    const claimStart = performance.now();
    const due = (await claimDueScopes()).filter((tick) => mine.has(tick.organizationId));
    const claimMs = performance.now() - claimStart;
    expect(due).toHaveLength(total);

    // 2. Fan-out: each tick becomes a run, 25 at a time (scope-fire's concurrency).
    const startLatencies: number[] = [];
    const itemsByOrg = new Map<string, string[]>();
    const fanStart = performance.now();
    await pool<DueScope>(due, 25, async (tick) => {
      const t = performance.now();
      const id = await fireScope(tick);
      startLatencies.push(performance.now() - t);
      if (id) itemsByOrg.set(tick.organizationId, [...(itemsByOrg.get(tick.organizationId) ?? []), id]);
    });
    const fanOutMs = performance.now() - fanStart;
    const items = [...itemsByOrg.values()].flat();
    expect(items).toHaveLength(total);

    // 3. The runner: platform ceiling across everyone, 3 at a time within each organisation.
    let maxQueued = 0;
    const sampler = setInterval(async () => {
      const queued = await prisma.actionItem.count({ where: { organizationId: { in: orgIds }, status: "queued" } });
      maxQueued = Math.max(maxQueued, queued);
    }, 500);
    const runDurations: number[] = [];
    const orgSlots = new Map<string, number>();
    const drainStart = performance.now();
    const perOrgQueues = [...itemsByOrg.entries()].map(([org, ids]) => ids.map((id) => ({ org, id }))).flat();
    await pool(perOrgQueues, env.workMaxConcurrentRuns, async ({ org, id }) => {
      // Respect the per-organisation limit by waiting for a slot.
      while ((orgSlots.get(org) ?? 0) >= 3) await new Promise((r) => setTimeout(r, 20));
      orgSlots.set(org, (orgSlots.get(org) ?? 0) + 1);
      const t = performance.now();
      try {
        await runActionItem(id, inlineSteps);
      } finally {
        runDurations.push(performance.now() - t);
        orgSlots.set(org, (orgSlots.get(org) ?? 0) - 1);
      }
    });
    const drainMs = performance.now() - drainStart;
    clearInterval(sampler);

    const statuses = await prisma.actionItem.groupBy({
      by: ["status"],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    });
    const steps = await prisma.auditLog.count({ where: { organizationId: { in: orgIds }, action: "tool.called" } });

    // The ideal: every run's model time, spread perfectly across the ceiling.
    const idealMs = (total / Math.min(env.workMaxConcurrentRuns, total)) * (TOOL_CALLS_PER_RUN + 2) * MODEL_LATENCY_MS;
    console.table({
      "runs": total,
      "tool calls recorded": steps,
      "claim (ms)": Math.round(claimMs),
      "fan-out total (ms)": Math.round(fanOutMs),
      "run start p50 / p95 (ms)": `${Math.round(pct(startLatencies, 50))} / ${Math.round(pct(startLatencies, 95))}`,
      "max queue depth": maxQueued,
      "run p50 / p95 (s)": `${(pct(runDurations, 50) / 1000).toFixed(1)} / ${(pct(runDurations, 95) / 1000).toFixed(1)}`,
      "drain (s)": (drainMs / 1000).toFixed(1),
      "ideal drain (s)": (idealMs / 1000).toFixed(1),
      "database": env.databaseProvider,
    });
    console.table(Object.fromEntries(statuses.map((s) => [s.status, s._count._all])));

    // Nothing lost, nothing failed, every tool call on the record.
    expect(statuses.find((s) => s.status === "done")?._count._all).toBe(total);
    expect(steps).toBe(total * TOOL_CALLS_PER_RUN);
    // Budgets: the claim stays quick, a run starts in well under a second, and
    // the burst drains within 2x of the ideal - overhead, not a pile-up.
    expect(claimMs).toBeLessThan(30_000);
    expect(pct(startLatencies, 95)).toBeLessThan(1_000);
    expect(drainMs).toBeLessThan(idealMs * 2);
  });
});
