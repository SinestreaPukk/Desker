/**
 * The correction loop: a correction saved from a rejected draft becomes a
 * rule the agent reads in both its chat and its run prompts, can be reworded
 * and removed, and every one of those changes is an audit row. Real route
 * handlers; only the session is faked. Needs DATABASE_URL; no model key.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const session = vi.hoisted(() => ({ user: { id: "", email: "" } }));
vi.mock("@/lib/auth", () => ({ currentUser: vi.fn(async () => session.user) }));

import { GET as listRules, POST as createRule } from "@/app/api/agents/[agentId]/rules/route";
import { DELETE as removeRule, PATCH as updateRule } from "@/app/api/agents/[agentId]/rules/[ruleId]/route";
import { GET as promptPreview } from "@/app/api/agents/[agentId]/prompt/route";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let orgId: string;
let agentId: string;
let runId: string;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `rules-${stamp}@example.com`, passwordHash: "x" } });
  session.user = { id: user.id, email: user.email };
  const org = await prisma.organization.create({
    data: {
      name: "Rules",
      slug: `rules-${stamp}`,
      memberships: { create: { userId: user.id, role: "owner" } },
      projects: { create: { name: "Rules", slug: `rules-${stamp}` } },
    },
    include: { projects: true },
  });
  orgId = org.id;
  const agent = await prisma.agent.create({
    data: { projectId: org.projects[0]!.id, name: "Nova", jobTitle: "Marketer", personality: "Plain.", responsibilities: [], allowedTools: [] },
  });
  agentId = agent.id;
  const run = await prisma.actionItem.create({
    data: { organizationId: orgId, agentId, type: "scope_run", trigger: "manual", payload: {}, status: "rejected" },
  });
  runId = run.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { email: `rules-${stamp}@example.com` } });
  await prisma.$disconnect();
});

const ctx = <T extends Record<string, string>>(extra?: T) => ({ params: Promise.resolve({ agentId, ...(extra ?? ({} as T)) }) });
const json = (body: unknown, method = "POST") =>
  new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the correction loop", () => {
  it("saves a rejection as a rule the agent reads, and keeps every change on the record", async () => {
    const created = await createRule(
      json({ text: "Never mention discounts in posts.", source: "rejection", actionItemId: runId }),
      ctx(),
    );
    expect(created.status).toBe(200);
    const rule = (await created.json()) as { id: string; source: string };
    expect(rule.source).toBe("rejection");

    const preview = (await (await promptPreview(new Request("http://localhost/x"), ctx())).json()) as {
      prompt: string;
      workPrompt: string;
    };
    expect(preview.prompt).toContain("Never mention discounts in posts.");
    expect(preview.workPrompt).toContain("Never mention discounts in posts.");

    const updated = await updateRule(json({ text: "Never mention prices or discounts." }, "PATCH"), ctx({ ruleId: rule.id }));
    expect(updated.status).toBe(200);
    const listed = (await (await listRules(new Request("http://localhost/x"), ctx())).json()) as { text: string }[];
    expect(listed.map((r) => r.text)).toEqual(["Never mention prices or discounts."]);

    expect((await removeRule(new Request("http://localhost/x", { method: "DELETE" }), ctx({ ruleId: rule.id }))).status).toBe(200);
    const trail = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: { startsWith: "agent_rule." } },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    expect(trail.map((row) => row.action)).toEqual(["agent_rule.created", "agent_rule.updated", "agent_rule.removed"]);
  });

  it("refuses a rule pinned to another agent's run", async () => {
    const response = await createRule(json({ text: "Something reasonable here.", actionItemId: "not-a-run" }), ctx());
    expect(response.status).toBe(404);
  });
});
