/**
 * The parts of autonomous work that only matter at scale, against a real
 * database: two schedulers racing for the same ticks, and the watchdog
 * noticing slow, dead and backed-up work nobody is watching.
 *
 * Needs DATABASE_URL. The job runtime is stubbed; no model is called.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));
const notified = vi.hoisted(() => [] as { title: string }[]);
vi.mock("@/lib/platform/notify", () => ({
  notifyInBackground: (n: { title: string }) => notified.push(n),
  notify: async () => undefined,
}));

import { claimDueScopes } from "@/lib/work/scope";
import { checkAutonomousWork } from "@/lib/work/watchdog";
import { env } from "@/lib/platform/env";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
const agentIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `Scale ${stamp}`, slug: `scale-${stamp}`, projects: { create: { name: "S", slug: `scale-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  const created = new Date(Date.now() - 24 * 60 * 60_000);
  for (let i = 0; i < 12; i++) {
    const agent = await prisma.agent.create({
      data: {
        projectId: org.projects[0]!.id,
        name: `A${i}`,
        jobTitle: "Tester",
        personality: "Plain.",
        responsibilities: [],
        allowedTools: [],
        status: "published",
        scopeOfWork: {
          // Every one of them "every minute": all due in the same tick.
          create: { objectives: ["x"], documentIds: [], triggerType: "cron", cron: "* * * * *", createdAt: created },
        },
      },
    });
    agentIds.push(agent.id);
  }
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.rateLimitWindow.deleteMany({ where: { key: { startsWith: "ops-alert:" } } });
  await prisma.$disconnect();
});

describe("schedules at scale", () => {
  it("fires each due tick exactly once when two schedulers race", async () => {
    const now = new Date();
    const [a, b] = await Promise.all([claimDueScopes(now), claimDueScopes(now)]);
    const mine = [...a, ...b].filter((tick) => tick.organizationId === organizationId);
    expect(mine).toHaveLength(12);
    expect(new Set(mine.map((tick) => tick.scopeId)).size).toBe(12);
    // And a later tick in the same minute claims nothing more.
    const again = (await claimDueScopes(new Date(now.getTime() + 1000))).filter((t) => t.organizationId === organizationId);
    expect(again).toHaveLength(0);
  });
});

describe("the watchdog", () => {
  const run = (status: string, fields: Record<string, unknown>) =>
    prisma.actionItem.create({
      data: { organizationId, agentId: agentIds[0]!, type: "scope_run", trigger: "schedule", status, payload: {}, ...fields },
    });

  it("tells the owner once about a slow run, and ends a dead one visibly", async () => {
    const budget = env.runTimeBudgetMs;
    const slow = await run("in_progress", { startedAt: new Date(Date.now() - budget - 60_000) });
    const dead = await run("in_progress", { startedAt: new Date(Date.now() - budget * 5) });

    await checkAutonomousWork();
    await checkAutonomousWork();

    expect(notified.filter((n) => n.title.includes("much longer"))).toHaveLength(1);
    expect((await prisma.actionItem.findUniqueOrThrow({ where: { id: slow.id } })).status).toBe("in_progress");
    const ended = await prisma.actionItem.findUniqueOrThrow({ where: { id: dead.id } });
    expect(ended.status).toBe("failed");
    expect(ended.error).toMatch(/far past the/);
    expect(await prisma.issue.count({ where: { actionItemId: dead.id, type: "failure" } })).toBe(1);
  });

  it("nudges the owner about an approval waiting a day, once a day", async () => {
    const waiting = await run("needs_approval", { awaitingSince: new Date(Date.now() - 25 * 60 * 60_000) });
    await checkAutonomousWork();
    await checkAutonomousWork();
    expect(notified.filter((n) => n.title.startsWith("Waiting on your OK"))).toHaveLength(1);
    // A day later it is still waiting: one more nudge.
    await checkAutonomousWork(new Date(Date.now() + 24 * 60 * 60_000 + 60_000));
    expect(notified.filter((n) => n.title.startsWith("Waiting on your OK"))).toHaveLength(2);
    await prisma.actionItem.delete({ where: { id: waiting.id } });
  });

  it("raises a queue backlog once an hour, not every five minutes", async () => {
    await prisma.rateLimitWindow.deleteMany({ where: { key: "ops-alert:queue-backlog" } });
    await run("queued", { createdAt: new Date(Date.now() - 30 * 60_000) });
    const first = await checkAutonomousWork();
    const second = await checkAutonomousWork();
    expect(first.alerts).toContain("queue-backlog");
    expect(first.oldestQueuedMs).toBeGreaterThan(20 * 60_000);
    expect(second.alerts).not.toContain("queue-backlog");
  });
});
