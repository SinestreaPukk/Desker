/**
 * Guided context against a real database: the answers are what is edited, the
 * composed string is what a run reads, and a project's shared context is
 * inherited by every agent in it without being copied into any of them.
 *
 * Needs DATABASE_URL. No model calls - drafting from documents is the one part
 * that needs one, and it is covered by its route rather than here.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { saveScope, toScopeDto } from "@/lib/work/scope";
import { saveProjectContext, readProjectContext } from "@/lib/work/project-context";
import { effectiveContext } from "@/lib/work/context";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let projectId: string;
let agentId: string;
let secondAgentId: string;

const baseScope = {
  context: "",
  objectives: ["Watch the competition"],
  documentIds: [],
  triggerType: "manual" as const,
  cron: null,
  timezone: "UTC",
  enabled: true,
  autonomy: "draft_only" as const,
  toolAutonomy: null,
  tools: null,
};

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: `Context org ${stamp}`,
      slug: `context-org-${stamp}`,
      projects: { create: { name: "Context", slug: `context-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  projectId = org.projects[0]!.id;
  const agents = await Promise.all(
    ["Robin", "Sam"].map((name) =>
      prisma.agent.create({
        data: {
          projectId,
          name,
          jobTitle: "Researcher",
          personality: "Careful.",
          responsibilities: [],
          allowedTools: [],
        },
      }),
    ),
  );
  agentId = agents[0]!.id;
  secondAgentId = agents[1]!.id;
}, 30_000);

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("an agent's own context", () => {
  it("is saved as answers and composed into the string a run reads", async () => {
    await saveScope(agentId, {
      ...baseScope,
      contextAnswers: {
        project: "We are pushing the lifetime hand-tool warranty this quarter.",
        never: "Never publish anything about pricing.",
        // An unknown id is dropped rather than stored.
        nonsense: "ignore me",
      },
    });

    const stored = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(stored.context).toContain("About this work: We are pushing the lifetime");
    expect(stored.context).toContain("Never: Never publish anything about pricing.");
    expect(stored.context).not.toContain("ignore me");
    expect(stored.contextAnswers).toEqual({
      project: "We are pushing the lifetime hand-tool warranty this quarter.",
      never: "Never publish anything about pricing.",
    });
  });

  it("survives a save from a caller that knows nothing about the questions", async () => {
    const before = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    // A template or a script saving the rest of the scope must not wipe what
    // the editor wrote.
    await saveScope(agentId, { ...baseScope, objectives: ["Something else"] });
    const after = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } });
    expect(after.contextAnswers).toEqual(before.contextAnswers);
    expect(after.context).toBe(before.context);
  });

  it("opens in the editor as answers, including text written before the questions existed", async () => {
    // A row as it would have been written before the questions existed.
    await prisma.scopeOfWork.create({
      data: {
        agentId: secondAgentId,
        context: "We sell hand tools to tradespeople.",
        objectives: [],
        documentIds: [],
      },
    });

    const scope = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId: secondAgentId } });
    const dto = toScopeDto(scope, secondAgentId);
    expect(dto.contextAnswers).toEqual({ project: "We sell hand tools to tradespeople." });
    expect(dto.context).toBe("We sell hand tools to tradespeople.");
  });
});

describe("the project's shared context", () => {
  it("is typed once and read by every agent in the project", async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const saved = await saveProjectContext(
      { id: projectId, organizationId },
      {
        business: "Northwind Supply Co. sells hand tools to tradespeople.",
        tone: "Plain and direct. No hype.",
      },
      "tester",
    );
    expect(saved.answered).toBe(2);
    expect(saved.context).toContain("The business: Northwind Supply Co.");
    expect(saved.context).toContain("House style: Plain and direct.");
    expect(project.context).toBe("");

    // Nothing was copied into either agent: they inherit it at read time, so
    // editing it once changes what both of them read.
    for (const id of [agentId, secondAgentId]) {
      const scope = await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId: id } });
      expect(scope.context).not.toContain("Northwind Supply Co.");

      const combined = effectiveContext({
        projectContext: saved.context,
        agentContext: scope.context,
      });
      expect(combined).toContain("Northwind Supply Co.");
      expect(combined.indexOf("Northwind")).toBeLessThan(
        combined.indexOf(scope.context.split("\n")[0]!),
      );
    }
  });

  it("reports how much is answered and what can be drafted from", async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const dto = await readProjectContext(project);
    expect(dto.answered).toBe(2);
    expect(dto.total).toBe(4);
    // No documents uploaded in this project, so a draft has nothing to read.
    expect(dto.documentCount).toBe(0);
  });
});
