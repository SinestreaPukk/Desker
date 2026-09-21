/**
 * Live test of the autonomous work loop: a real model, the real tool set, and
 * a local webhook standing in for the publishing integration.
 *
 * Needs ANTHROPIC_API_KEY and DATABASE_URL. The Inngest send in startRun is
 * bypassed: the runner is driven directly with inline steps.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import { runActionItem, executeApprovedAction, transition, inlineSteps } from "@/lib/work/runner";
import { saveScope, fireDueScopes } from "@/lib/work/scope";

const prisma = new PrismaClient();
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
const describeLive = hasKey ? describe : describe.skip;

const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;
let server: Server;
let webhookUrl: string;
const received: unknown[] = [];

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: `Work org ${stamp}`,
      slug: `work-org-${stamp}`,
      projects: { create: { name: "Work", slug: `work-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Sam",
      jobTitle: "Content Marketer",
      personality: "Concise and upbeat. Writes in plain English, no hashtags.",
      responsibilities: ["Write social posts"],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;

  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  webhookUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/hook`;
  await prisma.integration.create({
    data: {
      organizationId,
      type: "webhook",
      name: "Test hook",
      config: { url: webhookUrl, secret: "s3cret" },
    },
  });
}, 30_000);

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("scheduling", () => {
  it("fires a cron scope once per due tick and never twice", async () => {
    await saveScope(agentId, {
      context: "",
      objectives: ["x"],
      documentIds: [],
      triggerType: "cron",
      cron: "*/5 * * * *",
      timezone: "UTC",
      enabled: true,
      autonomy: "draft_only",
      toolAutonomy: null,
    tools: null,
    });
    // Pretend the scope has existed since yesterday so a past tick is due.
    await prisma.scopeOfWork.update({
      where: { agentId },
      data: { createdAt: new Date(Date.now() - 86_400_000) },
    });
    const now = new Date("2026-09-20T10:07:00Z");
    const first = await fireDueScopes(now).catch(() => "send-failed");
    // startRun fails the item when Inngest is unreachable, but still creates it.
    const items = await prisma.actionItem.findMany({ where: { agentId, trigger: "schedule" } });
    expect(items).toHaveLength(1);
    expect(items[0]!.dedupeKey).toBe(`${(await prisma.scopeOfWork.findUniqueOrThrow({ where: { agentId } })).id}:2026-09-20T10:05:00.000Z`);
    expect(first === "send-failed" || Array.isArray(first)).toBe(true);

    await fireDueScopes(now); // same tick again -> nothing new
    await fireDueScopes(new Date("2026-09-20T10:09:00Z")); // still the 10:05 tick
    expect(await prisma.actionItem.count({ where: { agentId, trigger: "schedule" } })).toBe(1);

    await fireDueScopes(new Date("2026-09-20T10:11:00Z")); // 10:10 is due
    expect(await prisma.actionItem.count({ where: { agentId, trigger: "schedule" } })).toBe(2);
    await prisma.actionItem.deleteMany({ where: { agentId } });
  });
});

describeLive("a live autonomous run", () => {
  it("drafts, stops at publish_post for approval, then delivers on approval", async () => {
    await saveScope(agentId, {
      context:
        "We are Northwind Supply Co., a hardware store. This week we launched a lifetime warranty on all hand tools.",
      objectives: [
        "Write one short social caption (under 200 characters) announcing the lifetime hand-tool warranty. Do not research the web; everything you need is in the context.",
        "Publish it with publish_post.",
      ],
      documentIds: [],
      triggerType: "manual",
      cron: null,
      timezone: "UTC",
      enabled: true,
      autonomy: "draft_only",
      toolAutonomy: null,
    tools: null,
    });
    const item = await prisma.actionItem.create({
      data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} },
    });

    const status = await runActionItem(item.id, inlineSteps);
    expect(status).toBe("needs_approval");

    const after = await prisma.actionItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { drafts: true },
    });
    expect(after.drafts.length).toBeGreaterThanOrEqual(1);
    expect(after.drafts[0]!.status).toBe("draft");
    const pending = after.pendingAction as { tool: string; draftId?: string };
    expect(pending.tool).toBe("publish_post");
    expect(pending.draftId).toBe(after.drafts.find((d) => d.id === pending.draftId)?.id);
    expect((after.result as { summary?: string }).summary).toBeTruthy();
    expect(received).toHaveLength(0); // nothing went out
    expect(after.inputTokens).toBeGreaterThan(0);

    const steps = after.steps as { tool: string; ok: boolean }[];
    expect(steps.map((s) => s.tool)).toContain("draft_content");
    expect(steps.map((s) => s.tool)).toContain("publish_post");

    // A human approves.
    await transition(item.id, "approved", { approvedAt: new Date() });
    const final = await executeApprovedAction(item.id, inlineSteps);
    expect(final).toBe("done");
    expect(received).toHaveLength(1);
    const delivery = received[0] as { headers: Record<string, string>; body: { event: string; draft: { body: string } } };
    expect(delivery.body.event).toBe("publish_post");
    expect(delivery.body.draft.body).toBe(after.drafts.find((d) => d.id === pending.draftId)!.body);
    expect(delivery.headers["x-desker-signature"]).toMatch(/^sha256=/);

    const draft = await prisma.draft.findUniqueOrThrow({ where: { id: pending.draftId! } });
    expect(draft.status).toBe("published");

    const audits = await prisma.auditLog.findMany({
      where: { targetId: item.id, action: "tool.called" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it("in auto mode the same run publishes without stopping", async () => {
    await prisma.scopeOfWork.update({ where: { agentId }, data: { autonomy: "auto" } });
    const item = await prisma.actionItem.create({
      data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} },
    });
    const before = received.length;
    const status = await runActionItem(item.id, inlineSteps);
    expect(status).toBe("done");
    expect(received.length).toBe(before + 1);
    const after = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.pendingAction).toBeNull();
    expect((after.result as { external?: { ok: boolean } }).external?.ok).toBe(true);
  }, 180_000);
});

const hasSearch = Boolean(process.env.TAVILY_API_KEY?.trim() || process.env.BRAVE_SEARCH_API_KEY?.trim());
(hasKey && hasSearch ? describe : describe.skip)("web_research", () => {
  it("searches, reads pages and summarises with numbered sources", async () => {
    const { researchTheWeb } = await import("@/lib/work/research");
    const findings = await researchTheWeb({
      query: "pgvector Postgres extension",
      focus: "what it is and what index types it supports",
      billing: { organizationId, agentId },
      modelProvider: "anthropic",
      model: null,
    });
    expect(findings.sources.length).toBeGreaterThan(0);
    expect(findings.findings.length).toBeGreaterThan(50);
    expect(findings.findings).toMatch(/\[\d\]/);

    // The same query again is served from the cache and still metered.
    const { webSearch } = await import("@/lib/work/research");
    const again = await webSearch("pgvector Postgres extension");
    expect(again.cached).toBe(true);
    const { usageForOrganization } = await import("@/lib/usage");
    const usage = await usageForOrganization(organizationId);
    expect(usage.searches).toBeGreaterThanOrEqual(1);
    expect(usage.pagesRead).toBeGreaterThan(0);
  }, 120_000);
});

describeLive("oversight", () => {
  it("fires the escalation rule, honours a per-tool override, and leaves a full trail", async () => {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        escalationRule:
          "Escalate if you are asked to email more than 20 people at once, or if you cannot find reliable sources.",
      },
    });
    await saveScope(agentId, {
      context: "We are Northwind Supply Co., a hardware store.",
      objectives: [
        "Write one short social caption (under 200 characters) about our new cordless drill and publish it with publish_post.",
        "Then send an email announcing the drill to all 45 customers in our newsletter list at newsletter@northwind.example using send_email. Do not research the web.",
      ],
      documentIds: [],
      triggerType: "manual",
      cron: null,
      timezone: "UTC",
      enabled: true,
      autonomy: "draft_only",
      // Posts are trusted; emails still wait.
      toolAutonomy: { publish_post: "auto" },
    tools: null,
    });
    await prisma.integration.create({
      data: {
        organizationId,
        type: "email",
        name: "Fake Resend",
        config: { provider: "resend", from: "sam@northwind.example", apiKey: "re_fake" },
      },
    });

    const item = await prisma.actionItem.create({
      data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} },
    });
    const before = received.length;
    const status = await runActionItem(item.id, inlineSteps);

    const after = await prisma.actionItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { drafts: true, issues: true },
    });
    const steps = (after.steps as { tool: string }[]).map((s) => s.tool);

    // The post went straight out (per-tool auto); the email is gated or escalated.
    expect(received.length).toBe(before + 1);
    expect(steps).toContain("publish_post");
    expect(after.drafts.some((d) => d.kind === "social_caption" && d.status === "published")).toBe(true);
    expect(["needs_approval", "done"]).toContain(status);
    if (status === "needs_approval") {
      expect((after.pendingAction as { tool: string }).tool).toBe("send_email");
      expect(after.awaitingSince).not.toBeNull();
    }
    // 45 recipients trips the rule: the agent escalated and an issue exists.
    expect(after.escalatedAt).not.toBeNull();
    expect(steps).toContain("escalate_to_human");
    expect(after.issues.some((i) => i.type === "escalation" && i.source === "agent")).toBe(true);

    // Every tool call is on the record with its trigger and result.
    const trail = await prisma.auditLog.findMany({
      where: { targetId: item.id, action: "tool.called" },
      orderBy: { createdAt: "asc" },
    });
    expect(trail.length).toBe(steps.length);
    for (const row of trail) {
      const meta = row.metadata as { trigger?: string; result?: string; tool?: string };
      expect(meta.trigger).toBe("manual");
      expect(typeof meta.result).toBe("string");
    }
  }, 240_000);
});
