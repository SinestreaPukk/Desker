/**
 * Cancelling a running task stops it before its next tool acts and before its
 * next model turn. No model key: the model turn is scripted through the step
 * runner, which is also where the owner "presses Cancel".
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { runActionItem, transition, type StepRunner } from "@/lib/work/runner";
import { saveScope } from "@/lib/work/scope";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: `Cancel org ${stamp}`,
      slug: `cancel-org-${stamp}`,
      projects: {
        create: {
          name: "Cancel",
          slug: `cancel-${stamp}`,
          context: "The business: Northwind Supply Co. sells hand tools to tradespeople.",
          contextAnswers: {
            about: "Northwind Supply Co. sells hand tools to tradespeople.",
            tone: "Plain and direct.",
          },
        },
      },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Sam",
      jobTitle: "Content Marketer",
      personality: "Plain English.",
      responsibilities: ["Write social posts"],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;
  await saveScope(agentId, {
    context: "We sell hand tools.",
    objectives: ["Draft one social caption."],
    documentIds: [],
    triggerType: "manual",
    cron: null,
    timezone: "UTC",
    enabled: true,
    autonomy: "draft_only",
    toolAutonomy: null,
    tools: null,
  });
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("cancelling a running task", () => {
  it("stops before the tool the model asked for, and takes no further turn", async () => {
    const item = await prisma.actionItem.create({
      data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} },
    });
    const turns: string[] = [];

    const step: StepRunner = async (id, fn) => {
      if (id.startsWith("turn-")) {
        turns.push(id);
        // The owner cancels while the model is thinking; the model then asks for a tool.
        await transition(item.id, "cancelled", { error: "Cancelled by you." });
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [{ id: "call-1", name: "draft_content", input: { kind: "social_post", title: "t", body: "b" } }],
          },
          stopReason: "tool_use",
          usage: { inputTokens: 1, outputTokens: 1 },
        } as never;
      }
      if (id === "summarize") return null as never; // no model call for the summary
      return fn();
    };

    const status = await runActionItem(item.id, step);

    expect(status).toBe("cancelled");
    expect(turns).toEqual(["turn-0"]);
    const after = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id }, include: { drafts: true } });
    expect(after.drafts).toHaveLength(0);
    expect((after.steps as unknown[] | null) ?? []).toHaveLength(0);
    expect(after.error).toBe("Cancelled by you.");
  });
});
