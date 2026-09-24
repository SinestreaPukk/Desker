/**
 * The reporting loop against a real database: a finished run gets a
 * plain-language summary, a period of runs rolls up into one digest, and a
 * suggestion an owner accepts becomes a standing objective.
 *
 * Needs DATABASE_URL. With no provider key in the environment the summariser
 * and the digest writer take their deterministic fallbacks, which is exactly
 * the path a self-hosted install runs on - so this test is meaningful either
 * way and asserts on shape rather than on wording.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { summarizeRun } from "@/lib/work/summary";
import { generateDigest, runDueDigests } from "@/lib/work/digest";
import { decideSuggestion } from "@/lib/work/suggestions";
import { saveScope } from "@/lib/work/scope";
import { toStringArray } from "@/lib/agent-fields";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: `Digest org ${stamp}`,
      slug: `digest-org-${stamp}`,
      projects: { create: { name: "Digest", slug: `digest-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Robin",
      jobTitle: "Researcher",
      personality: "Careful and brief.",
      responsibilities: ["Watch the competition"],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;
}, 30_000);

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

/** A finished run, written straight to the database - no model call involved. */
async function finishedRun(overrides: Partial<Prisma.ActionItemUncheckedCreateInput> = {}) {
  return prisma.actionItem.create({
    data: {
      organizationId,
      agentId,
      type: "scope_run",
      trigger: "schedule",
      status: "done",
      payload: {},
      result: { summary: "Checked three competitors. Two raised prices this month." },
      steps: [
        { at: new Date().toISOString(), tool: "web_research", input: { query: "pricing" }, output: "found", ok: true },
      ],
      completedAt: new Date(),
      ...overrides,
    },
  });
}

describe("the summary on a run", () => {
  it("is written next to the raw report, not over it", async () => {
    const item = await finishedRun();
    const summary = await summarizeRun(item.id);
    expect(summary).not.toBeNull();

    const stored = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.summary).toBeTruthy();
    expect(stored.headline).toBeTruthy();
    expect(stored.headline!.length).toBeLessThanOrEqual(80);
    // The agent's own report is still underneath it.
    expect((stored.result as { summary?: string }).summary).toContain("Checked three competitors");
  }, 60_000);

  it("is written once, however many times the step is retried", async () => {
    const item = await finishedRun();
    await summarizeRun(item.id);
    const first = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });

    expect(await summarizeRun(item.id)).toBeNull();
    const second = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(second.summary).toBe(first.summary);
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  }, 60_000);
});

describe("the digest", () => {
  it("rolls the period up, records what it covered, and moves its window on", async () => {
    await saveScope(agentId, {
      context: "",
      objectives: ["Watch the competition"],
      documentIds: [],
      triggerType: "manual",
      cron: null,
      timezone: "UTC",
      enabled: true,
      autonomy: "draft_only",
      toolAutonomy: null,
      tools: null,
      digestCadence: "weekly",
      digestEmail: false,
      digestRecipients: "",
    });
    const item = await finishedRun();
    await summarizeRun(item.id);

    const digest = await generateDigest(agentId);
    expect(digest).not.toBeNull();

    const stored = await prisma.digest.findUniqueOrThrow({ where: { id: digest!.id } });
    expect(stored.cadence).toBe("weekly");
    expect(stored.headline).toBeTruthy();
    const bullets = stored.bullets as { kind: string; text: string }[];
    expect(bullets.length).toBeGreaterThan(0);
    expect(bullets.length).toBeLessThanOrEqual(6);
    expect((stored.actionItemIds as string[]).length).toBeGreaterThan(0);
    expect(stored.readAt).toBeNull();
    // Emailing was off, so nothing was attempted and nothing is recorded as failed.
    expect(stored.emailedAt).toBeNull();
    expect(stored.emailError).toBeNull();

    const scope = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(scope.lastDigestAt).not.toBeNull();
  }, 90_000);

  it("sends nothing when a period held nothing, but still moves on", async () => {
    await prisma.digest.deleteMany({ where: { agentId } });
    await prisma.actionItem.deleteMany({ where: { agentId } });
    // An outstanding suggestion is itself something to report, so a truly
    // empty period has none either.
    await prisma.suggestion.deleteMany({ where: { agentId } });
    await prisma.scopeOfWork.update({
      where: { agentId },
      data: { lastDigestAt: new Date(Date.now() - 60_000) },
    });

    expect(await generateDigest(agentId)).toBeNull();
    expect(await prisma.digest.count({ where: { agentId } })).toBe(0);
    const scope = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(scope.lastDigestAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  }, 60_000);

  it("is skipped entirely when the owner turned it off", async () => {
    await prisma.scopeOfWork.update({ where: { agentId }, data: { digestCadence: "off" } });
    await finishedRun();
    expect(await generateDigest(agentId)).toBeNull();
    // ...but "send me one now" still works, because that is a different ask.
    const forced = await generateDigest(agentId, { force: true });
    expect(forced).not.toBeNull();
    await prisma.digest.deleteMany({ where: { agentId } });
  }, 90_000);

  it("fires once per due cadence and never twice for the same one", async () => {
    await prisma.digest.deleteMany({ where: { agentId } });
    await prisma.actionItem.deleteMany({ where: { agentId } });
    await finishedRun();
    await prisma.scopeOfWork.update({
      where: { agentId },
      data: {
        digestCadence: "daily",
        timezone: "UTC",
        // Just before the run above, so the run falls inside the window.
        lastDigestAt: new Date(Date.now() - 3_600_000),
      },
    });

    // A day ahead, so the most recent 08:00 tick is due and the run that was
    // written a moment ago sits inside the period it covers.
    const now = new Date(Date.now() + 86_400_000);
    await runDueDigests(now);
    const after = await prisma.digest.count({ where: { agentId } });
    expect(after).toBeGreaterThanOrEqual(1);

    await runDueDigests(now); // the same tick again
    expect(await prisma.digest.count({ where: { agentId } })).toBe(after);
  }, 90_000);
});

describe("a suggestion the owner accepts", () => {
  it("becomes a standing objective, once", async () => {
    const before = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    const objectivesBefore = toStringArray(before.objectives);

    const suggestion = await prisma.suggestion.create({
      data: {
        organizationId,
        agentId,
        summary: "Two rivals raised prices",
        rationale: "Our positioning line is now out of date.",
        proposal: "Draft a pricing comparison post each month",
      },
    });

    const accepted = await decideSuggestion({
      suggestionId: suggestion.id,
      status: "accepted",
      userId: "tester",
    });
    expect(accepted?.addedObjective).toBe("Draft a pricing comparison post each month");

    const after = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(toStringArray(after.objectives)).toEqual([
      ...objectivesBefore,
      "Draft a pricing comparison post each month",
    ]);

    // Accepting the same idea again must not give the agent the same
    // instruction twice.
    const again = await decideSuggestion({
      suggestionId: suggestion.id,
      status: "accepted",
      userId: "tester",
    });
    expect(again?.addedObjective).toBeNull();
    const unchanged = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(toStringArray(unchanged.objectives)).toHaveLength(objectivesBefore.length + 1);
  }, 30_000);

  it("comes back after a snooze runs out and leaves the objectives alone", async () => {
    const suggestion = await prisma.suggestion.create({
      data: {
        organizationId,
        agentId,
        summary: "Try a weekly newsletter",
        rationale: "Readers keep asking for one.",
        proposal: "Draft a weekly newsletter",
      },
    });
    const snoozed = await decideSuggestion({
      suggestionId: suggestion.id,
      status: "snoozed",
      snoozeDays: 7,
      userId: "tester",
    });
    expect(snoozed?.status).toBe("snoozed");
    expect(new Date(snoozed!.snoozedUntil!).getTime()).toBeGreaterThan(Date.now());
    expect(snoozed?.addedObjective).toBeNull();

    const scope = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(toStringArray(scope.objectives)).not.toContain("Draft a weekly newsletter");
  }, 30_000);
});
