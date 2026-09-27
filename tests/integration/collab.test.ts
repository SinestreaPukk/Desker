/**
 * Agents handing work to each other: the hand-off itself, the loops it must
 * refuse, and the record the Team chat preview is drawn from.
 *
 * Needs DATABASE_URL only. The job runtime is stubbed, so a hand-off is
 * recorded but the colleague's run never starts - no model is called.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { executeWorkTool, type RunContext } from "@/lib/work/execute";
import { actionItemInclude, toActionItemDto } from "@/app/api/action-items/serialize";
import { threadOf, threadRoots } from "@/lib/work/thread";
import { describeAuditEntry } from "@/lib/audit-copy";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
const agents: Record<"bright" | "tim" | "moon" | "draft", string> = {
  bright: "",
  tim: "",
  moon: "",
  draft: "",
};

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: `Collab org ${stamp}`,
      slug: `collab-org-${stamp}`,
      projects: { create: { name: "Collab", slug: `collab-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  for (const [key, name, status] of [
    ["bright", "Bright", "published"],
    ["tim", "Tim", "published"],
    ["moon", "Moon", "published"],
    ["draft", "Drafty", "draft"],
  ] as const) {
    const agent = await prisma.agent.create({
      data: {
        projectId: org.projects[0]!.id,
        name,
        jobTitle: "Tester",
        personality: "Plain.",
        responsibilities: [],
        allowedTools: [],
        status,
      },
    });
    agents[key] = agent.id;
  }
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

async function runFor(agentKey: keyof typeof agents): Promise<RunContext> {
  const item = await prisma.actionItem.create({
    data: { organizationId, agentId: agents[agentKey], type: "scope_run", trigger: "manual", payload: {} },
  });
  return ctxFor(agentKey, item.id);
}

function ctxFor(agentKey: keyof typeof agents, actionItemId: string): RunContext {
  return {
    actionItemId,
    organizationId,
    agent: { id: agents[agentKey], name: agentKey, modelProvider: "anthropic", model: null },
    autonomy: "draft_only",
    toolAutonomy: null,
    tools: ["delegate_to_colleague"],
    documentIds: [],
    trigger: "manual",
  };
}

function delegate(ctx: RunContext, to: keyof typeof agents, task = "Draft a post") {
  return executeWorkTool(
    { id: `call-${Math.random()}`, name: "delegate_to_colleague", input: { colleague_id: agents[to], task } },
    ctx,
  );
}

async function handoffFrom(parentId: string, agentKey: keyof typeof agents) {
  return prisma.actionItem.findFirstOrThrow({
    where: { parentId, agentId: agents[agentKey], type: "colleague_delegation" },
  });
}

describe("agents working together", () => {
  it("hands a task to a colleague, and both sides read it as a chat", async () => {
    const bright = await runFor("bright");
    const outcome = await delegate(bright, "tim", "Write a caption about the warranty");
    expect(outcome.isError).toBeFalsy();

    const handoff = await handoffFrom(bright.actionItemId, "tim");
    expect(handoff.trigger).toBe("delegation");

    const parent = toActionItemDto(
      await prisma.actionItem.findUniqueOrThrow({ where: { id: bright.actionItemId }, include: actionItemInclude }),
    );
    expect(parent.collab.handoffs).toHaveLength(1);
    expect(parent.collab.handoffs[0]).toMatchObject({ task: "Write a caption about the warranty", status: "queued" });
    expect(parent.collab.handoffs[0]!.agent.id).toBe(agents.tim);

    const child = toActionItemDto(
      await prisma.actionItem.findUniqueOrThrow({ where: { id: handoff.id }, include: actionItemInclude }),
    );
    expect(child.collab.askedBy?.agent.id).toBe(agents.bright);
    expect(child.collab.askedBy?.task).toBe("Write a caption about the warranty");
  });

  it("refuses to hand a task back to whoever it came from", async () => {
    const bright = await runFor("bright");
    await delegate(bright, "tim");
    const tim = ctxFor("tim", (await handoffFrom(bright.actionItemId, "tim")).id);

    const outcome = await delegate(tim, "bright");
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toMatch(/already part of this chain/);
  });

  it("refuses itself, drafts and strangers", async () => {
    const bright = await runFor("bright");
    expect((await delegate(bright, "bright")).isError).toBe(true);
    expect((await delegate(bright, "draft")).isError).toBe(true);
  });

  it("stops a relay after two hand-offs", async () => {
    const bright = await runFor("bright");
    await delegate(bright, "tim");
    const tim = ctxFor("tim", (await handoffFrom(bright.actionItemId, "tim")).id);
    expect((await delegate(tim, "moon")).isError).toBeFalsy();
    const moon = ctxFor("moon", (await handoffFrom(tim.actionItemId, "moon")).id);

    // Moon may not pass it on again, even to someone new to the chain.
    const fresh = await prisma.agent.create({
      data: {
        projectId: (await prisma.agent.findUniqueOrThrow({ where: { id: agents.bright } })).projectId,
        name: "Sam",
        jobTitle: "Tester",
        personality: "Plain.",
        responsibilities: [],
        allowedTools: [],
        status: "published",
      },
    });
    const outcome = await executeWorkTool(
      { id: "call-relay", name: "delegate_to_colleague", input: { colleague_id: fresh.id, task: "Finish it" } },
      moon,
    );
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toMatch(/handed on 2 times/);
  });

  it("reads an Assistant -> Marketer hand-off as one thread, with the reply on the asking run", async () => {
    const project = await prisma.agent.findUniqueOrThrow({ where: { id: agents.bright }, select: { projectId: true } });
    const [assistant, marketer] = await Promise.all(
      [
        ["Ava", "Executive Assistant"],
        ["Max", "Content Marketer"],
      ].map(([name, jobTitle]) =>
        prisma.agent.create({
          data: { ...project, name: name!, jobTitle: jobTitle!, personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
        }),
      ),
    );
    const run = await prisma.actionItem.create({
      data: { organizationId, agentId: assistant!.id, type: "scope_run", trigger: "manual", payload: {} },
    });
    const ctx: RunContext = { ...ctxFor("bright", run.id), agent: { id: assistant!.id, name: "Ava", modelProvider: "anthropic", model: null } };
    const outcome = await executeWorkTool(
      { id: "call-pair", name: "delegate_to_colleague", input: { colleague_id: marketer!.id, task: "Announce the new opening hours" } },
      ctx,
    );
    expect(outcome.isError).toBeFalsy();

    // The Marketer finishes its run.
    const handoff = await prisma.actionItem.findFirstOrThrow({ where: { parentId: run.id, agentId: marketer!.id } });
    await prisma.actionItem.update({
      where: { id: handoff.id },
      data: { status: "done", headline: "Drafted the opening-hours post for your approval" },
    });

    // One thread, whichever run it is opened from.
    expect(await threadOf(handoff.id)).toEqual([run.id, handoff.id]);
    expect(await threadOf(run.id)).toEqual([run.id, handoff.id]);
    const roots = await threadRoots([run.id, handoff.id]);
    expect(roots.get(run.id)).toBe(run.id);
    expect(roots.get(handoff.id)).toBe(run.id);

    // The audit row says it in words, naming the colleague.
    const row = await prisma.auditLog.findFirstOrThrow({ where: { targetId: run.id, action: "tool.called" } });
    const described = describeAuditEntry({ ...row, metadata: row.metadata as Record<string, unknown> });
    expect(described.title).toBe("Handed work to Max");
    expect(described.detail).toBe("Announce the new opening hours");

    // The Marketer's answer is on the Assistant's run.
    const parent = toActionItemDto(
      await prisma.actionItem.findUniqueOrThrow({ where: { id: run.id }, include: actionItemInclude }),
    );
    expect(parent.collab.handoffs[0]).toMatchObject({
      status: "done",
      reply: "Drafted the opening-hours post for your approval",
    });

    // A run with no hand-off is in no thread.
    const solo = await runFor("moon");
    expect((await threadRoots([solo.actionItemId])).size).toBe(0);
  });
});
