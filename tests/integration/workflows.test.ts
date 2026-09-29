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
let researcher: string;
let marketer: string;

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
  researcher = (await make("Sol", "Research Analyst")).id;
  marketer = (await make("Nova", "Content Marketer")).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("a named workflow", () => {
  it("runs research, hands the findings to the marketer, and stops in Needs you", async () => {
    const { id: rootId } = (await startWorkflow({
      workflowId: "research-to-post",
      projectId,
      organizationId: orgId,
      text: "Competitor warranties this month",
      agentIds: [researcher, marketer],
      userId,
    }))!;

    let [view] = await workflowRuns(projectId);
    expect(view!.rootId).toBe(rootId);
    expect(view!.steps.map((s) => s.state)).toEqual(["with_agent", "not_started"]);

    // Step 1 finishes with findings.
    await prisma.actionItem.update({
      where: { id: rootId },
      data: {
        status: "done",
        result: { summary: "Two competitors moved to 36 months.", findings: [{ query: "warranty", findings: "Fabrikam: 36 months." }] },
      },
    });
    await advanceWorkflow(rootId);
    await advanceWorkflow(rootId); // twice: still one next step

    const next = await prisma.actionItem.findMany({ where: { parentId: rootId } });
    expect(next).toHaveLength(1);
    expect(next[0]!.agentId).toBe(marketer);
    expect(next[0]!.type).toBe("colleague_delegation");
    const payload = next[0]!.payload as { context: string; workflow: { step: number; rootId: string } };
    expect(payload.context).toContain("Two competitors moved to 36 months.");
    expect(payload.context).toContain("Fabrikam: 36 months.");
    expect(payload.workflow).toMatchObject({ step: 1, rootId });

    // Step 2 queues the post for approval.
    await prisma.actionItem.update({ where: { id: next[0]!.id }, data: { status: "needs_approval" } });
    [view] = await workflowRuns(projectId);
    expect(view!.steps.map((s) => s.state)).toEqual(["done", "needs_you"]);
    expect(view!.current).toBe(1);
  });

  it("refuses to start without a switched-on agent for every step, or without its input", async () => {
    const draft = await prisma.agent.create({
      data: { projectId, name: "Draft", jobTitle: "Marketer", personality: "Plain.", responsibilities: [], allowedTools: [] },
    });
    await expect(
      startWorkflow({ workflowId: "research-to-post", projectId, organizationId: orgId, text: "x", agentIds: [researcher, draft.id], userId }),
    ).rejects.toThrow(/switched on/);
    await expect(
      startWorkflow({ workflowId: "research-to-post", projectId, organizationId: orgId, text: " ", agentIds: [researcher, marketer], userId }),
    ).rejects.toThrow(/needs something to work on/);
  });
});
