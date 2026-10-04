import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";

/** Runs a real model against a real (local) browser: opt in with BROWSER_E2E=1 BROWSER_LOCAL=1. */
const run = process.env.BROWSER_E2E === "1" && (process.env.BROWSER_LOCAL === "1" || Boolean(process.env.BROWSERBASE_API_KEY));
const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId = "";
let projectId = "";
let agentId = "";

beforeAll(async () => {
  if (!run) return;
  const org = await prisma.organization.create({
    data: { name: `Br ${stamp}`, slug: `br-${stamp}`, projects: { create: { name: "Br", slug: `br-project-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  projectId = org.projects[0]!.id;
  agentId = (await prisma.agent.create({ data: { projectId, name: "A", jobTitle: "x", personality: "x", responsibilities: [], allowedTools: [] } })).id;
});
afterAll(async () => {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

describe.skipIf(!run)("browser agent", () => {
  it("reads a page", async () => {
    const { runBrowserTask } = await import("@/lib/browser/agent");
    const out = await runBrowserTask({ organizationId, projectId, agentId, goal: "Open example.com and tell me the main heading on the page.", allowCommit: false, details: "", about: "" });
    expect(out.status).toBe("done");
    expect(out.summary).toMatch(/example domain/i);
  }, 120_000);

  it("fills a form but stops before submitting", async () => {
    const { runBrowserTask } = await import("@/lib/browser/agent");
    const out = await runBrowserTask({
      organizationId,
      projectId,
      agentId,
      goal: "Open https://httpbin.org/forms/post and fill in the pizza order form for Maya Lee, phone 0812345678, email maya@example.com, a small pizza with bacon. Do not submit it.",
      allowCommit: false,
      details: "Name: Maya Lee\nPhone: 0812345678\nEmail: maya@example.com",
      about: "Maya, a designer in Bangkok.",
    });
    expect(["commit_ready", "done"]).toContain(out.status);
    if (out.status === "commit_ready") expect(out.plan).toMatch(/maya/i);
  }, 180_000);

  it("stops for approval in approve-first mode, and browses in auto mode", async () => {
    const { executeWorkTool } = await import("@/lib/work/execute");
    const item = await prisma.actionItem.create({ data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {}, status: "in_progress" } });
    const base = { actionItemId: item.id, organizationId, agent: { id: agentId, name: "A", modelProvider: "anthropic", model: null }, tools: ["browse_web", "browse_commit"] as never, documentIds: [], trigger: "manual" };
    const gated = await executeWorkTool(
      { id: "t1", name: "browse_web", input: { goal: "Open example.com and read the heading." } },
      { ...base, autonomy: "draft_only", toolAutonomy: null },
    );
    expect(gated.gate?.tool).toBe("browse_web");
    expect(gated.gate?.input.allow_commit).toBe(true);
    await prisma.actionItem.update({ where: { id: item.id }, data: { pendingAction: Prisma.DbNull } });
    const auto = await executeWorkTool(
      { id: "t2", name: "browse_web", input: { goal: "Open example.com and tell me the main heading." } },
      { ...base, autonomy: "draft_only", toolAutonomy: { browse_web: "auto" } },
    );
    expect(auto.isError).toBeFalsy();
    expect(auto.content).toMatch(/example domain/i);
  }, 180_000);

  it("submits only when the plan is approved (commit mode)", async () => {
    const { runBrowserTask } = await import("@/lib/browser/agent");
    const out = await runBrowserTask({
      organizationId,
      projectId,
      agentId,
      goal: "Open https://httpbin.org/forms/post, fill in customer name Maya Lee, phone 0812345678, email maya@example.com, a small pizza with bacon, then press the Submit order button. Report the name shown in the result.",
      allowCommit: true,
      details: "Name: Maya Lee\nPhone: 0812345678\nEmail: maya@example.com",
      about: "",
    });
    expect(out.status).toBe("done");
    expect(out.summary).toMatch(/maya/i);
  }, 180_000);
});
