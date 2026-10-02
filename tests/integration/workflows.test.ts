/**
 * Named workflows: started on purpose, each step handed to the next with its
 * results when it finishes, and progress readable at every point - with an
 * agent, in Needs you, or done. The job runtime is faked; runs are moved by
 * hand so no model is needed. Needs DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { advanceWorkflow, startWorkflow, workflowRuns } from "@/lib/work/workflow-run";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let orgId: string;
let projectId: string;
let userId: string;
let money: string;
let assistant: string;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `wf-${stamp}@example.com`, passwordHash: "x" } });
  userId = user.id;
  const org = await prisma.organization.create({
    data: {
      name: "Workflows",
      slug: `wf-${stamp}`,
      memberships: { create: { userId, role: "owner" } },
      projects: { create: { name: "Workflows", slug: `wf-${stamp}` } },
    },
    include: { projects: true },
  });
  orgId = org.id;
  projectId = org.projects[0]!.id;
  const make = (name: string, jobTitle: string) =>
    prisma.agent.create({
      data: { projectId, name, jobTitle, personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
    });
  money = (await make("Penny", "Money Manager")).id;
  assistant = (await make("Juno", "Personal Assistant")).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("a named workflow", () => {
  it("runs the money check-in, hands it to life admin, and stops in Needs you", async () => {
    const { id: rootId } = (await startWorkflow({
      workflowId: "money-to-reminders",
      projectId,
      organizationId: orgId,
      text: "Subscriptions",
      agentIds: [money, assistant],
      userId,
    }))!;

    let [view] = await workflowRuns(projectId);
    expect(view!.rootId).toBe(rootId);
    expect(view!.steps.map((s) => s.state)).toEqual(["with_agent", "not_started"]);

    // Step 1 finishes with its findings.
    await prisma.actionItem.update({
      where: { id: rootId },
      data: {
        status: "done",
        result: { summary: "Three subscriptions to cancel.", findings: [{ query: "subscriptions", findings: "Streaming: 3 services." }] },
      },
    });
    await advanceWorkflow(rootId);
    await advanceWorkflow(rootId); // twice: still one next step

    const next = await prisma.actionItem.findMany({ where: { parentId: rootId } });
    expect(next).toHaveLength(1);
    expect(next[0]!.agentId).toBe(assistant);
    expect(next[0]!.type).toBe("colleague_delegation");
    const payload = next[0]!.payload as { context: string; workflow: { step: number; rootId: string } };
    expect(payload.context).toContain("Three subscriptions to cancel.");
    expect(payload.context).toContain("Streaming: 3 services.");
    expect(payload.workflow).toMatchObject({ step: 1, rootId });

    // Step 2 queues its reminders for approval.
    await prisma.actionItem.update({ where: { id: next[0]!.id }, data: { status: "needs_approval" } });
    [view] = await workflowRuns(projectId);
    expect(view!.steps.map((s) => s.state)).toEqual(["done", "needs_you"]);
    expect(view!.current).toBe(1);
  });

  it("refuses to start without a switched-on agent for every step", async () => {
    const draft = await prisma.agent.create({
      data: { projectId, name: "Draft", jobTitle: "Assistant", personality: "Plain.", responsibilities: [], allowedTools: [] },
    });
    await expect(
      startWorkflow({ workflowId: "money-to-reminders", projectId, organizationId: orgId, text: "x", agentIds: [money, draft.id], userId }),
    ).rejects.toThrow(/switched on/);
  });
});
