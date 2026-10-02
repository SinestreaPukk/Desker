/**
 * Social posting end to end against a real database, the networks faked at
 * the network edge: a LinkedIn draft waits for approval then posts as the
 * member and is recorded for later; Instagram without an image and an
 * over-long X post are refused before anything is queued; an edit that
 * Instagram doesn't allow is refused; a Facebook edit uses that Page's own
 * token; an X delete goes out once approved. Needs DATABASE_URL and VAULT_KEY.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { executePendingAction, executeWorkTool, type RunContext } from "@/lib/work/execute";
import { saveConnection } from "@/lib/integrations/oauth";
import type { PendingAction } from "@/lib/work/types";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;

const calls: { method: string; url: string; body: string; headers: Headers }[] = [];
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

function fake() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: typeof init?.body === "string" ? init.body : String(init?.body ?? ""), headers: new Headers(init?.headers) });
      if (url === "https://api.linkedin.com/rest/posts" && method === "POST") return json({}, 201, { "x-restli-id": "urn:li:share:777" });
      if (url.startsWith("https://graph.facebook.com/v23.0/page1_42") && method === "POST") return json({ success: true });
      if (url.startsWith("https://api.x.com/2/tweets/1500") && method === "DELETE") return json({ data: { deleted: true } });
      throw new Error(`Unexpected request in test: ${method} ${url}`);
    }),
  );
}

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `Social ${stamp}`, slug: `social-${stamp}`, projects: { create: { name: "S", slug: `social-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  agentId = (
    await prisma.agent.create({
      data: { projectId: org.projects[0]!.id, name: "Nova", jobTitle: "Content Marketer", personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
    })
  ).id;
  await saveConnection({ organizationId, connectorId: "linkedin", tokens: { accessToken: "li", extra: { personId: "abc123" } }, account: "Sam Lee" });
  await saveConnection({
    organizationId,
    connectorId: "meta",
    tokens: {
      accessToken: "user",
      extra: { pages: [{ id: "page1", name: "Acme Tools", token: "page-token", instagram: { id: "ig1", username: "acmetools" } }] },
    },
    account: "Acme Tools + @acmetools",
  });
  await saveConnection({ organizationId, connectorId: "x", tokens: { accessToken: "xt", extra: { userId: "u1" } }, account: "@acme" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

async function run(): Promise<RunContext> {
  const item = await prisma.actionItem.create({ data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} } });
  return {
    actionItemId: item.id,
    organizationId,
    agent: { id: agentId, name: "Nova", modelProvider: "anthropic", model: null },
    autonomy: "draft_only",
    toolAutonomy: null,
    tools: ["draft_content", "publish_post", "social_read", "social_manage"],
    documentIds: [],
    trigger: "manual",
  };
}
const tool = (ctx: RunContext, name: string, input: Record<string, unknown>) => executeWorkTool({ id: `c-${Math.random()}`, name, input }, ctx);
const draftId = (content: string) => /id (\S+) /.exec(content)![1]!;
const approve = async (ctx: RunContext) => {
  const item = await prisma.actionItem.findUniqueOrThrow({ where: { id: ctx.actionItemId } });
  return executePendingAction(ctx.actionItemId, organizationId, item.pendingAction as unknown as PendingAction);
};

describe("posting to social networks", () => {
  it("waits for approval, then posts to LinkedIn as the member and remembers the post", async () => {
    fake();
    const ctx = await run();
    const drafted = await tool(ctx, "draft_content", { kind: "social_caption", title: "Launch", body: "New drills (cordless) are in! #tools", platform: "LinkedIn" });
    const id = draftId(drafted.content);
    const queued = await tool(ctx, "publish_post", { draft_id: id });
    expect(queued.gate?.tool).toBe("publish_post");
    expect(calls).toHaveLength(0);

    const delivery = await approve(ctx);
    expect(delivery.ok).toBe(true);
    const sent = JSON.parse(calls[0]!.body) as { author: string; commentary: string };
    expect(sent.author).toBe("urn:li:person:abc123");
    expect(sent.commentary).toBe("New drills \\(cordless\\) are in! \\#tools");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer li");
    const draft = await prisma.draft.findUniqueOrThrow({ where: { id } });
    expect((draft.metadata as { external?: { id: string } }).external?.id).toBe("urn:li:share:777");

    // LinkedIn won't let an app read posts back; what Desker made is on record.
    const read = await tool(ctx, "social_read", { platform: "linkedin", action: "posts" });
    expect(read.content).toContain("urn:li:share:777");
  });

  it("refuses Instagram without an image, and an X post over 280 characters, before queueing anything", async () => {
    fake();
    const ctx = await run();
    const ig = draftId((await tool(ctx, "draft_content", { kind: "social_caption", title: "IG", body: "New in", platform: "Instagram" })).content);
    expect((await tool(ctx, "publish_post", { draft_id: ig })).isError).toBe(true);
    const x = draftId((await tool(ctx, "draft_content", { kind: "social_caption", title: "X", body: "a".repeat(281), platform: "X" })).content);
    const tooLong = await tool(ctx, "publish_post", { draft_id: x });
    expect(tooLong.isError).toBe(true);
    expect(tooLong.content).toContain("280");
    const item = await prisma.actionItem.findUniqueOrThrow({ where: { id: ctx.actionItemId } });
    expect(item.pendingAction).toBeNull();
  });
});

describe("changing posts afterwards", () => {
  it("refuses what the network doesn't allow, and edits a Facebook post with its Page's token", async () => {
    fake();
    const refused = await tool(await run(), "social_manage", { platform: "instagram", action: "edit", post_id: "m1", text: "New caption" });
    expect(refused.isError).toBe(true);

    const ctx = await run();
    expect((await tool(ctx, "social_manage", { platform: "facebook", action: "edit", post_id: "page1_42", text: "Now in stock" })).gate?.tool).toBe("social_manage");
    expect((await approve(ctx)).ok).toBe(true);
    expect(calls[0]!.body).toContain("access_token=page-token");
    expect(calls[0]!.body).toContain("message=Now+in+stock");
  });

  it("deletes an X post once approved", async () => {
    fake();
    const ctx = await run();
    await tool(ctx, "social_manage", { platform: "x", action: "delete", post_id: "1500" });
    expect(calls).toHaveLength(0);
    expect((await approve(ctx)).ok).toBe(true);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer xt");
  });
});

describe("in a personal space", () => {
  it("posts to X from someone's own space the same way, once they approve", async () => {
    const personal = await prisma.organization.create({
      data: { name: `Me ${stamp}`, slug: `me-${stamp}`, projects: { create: { name: "Me", slug: `me-${stamp}` } } },
      include: { projects: true },
    });
    try {
      const me = await prisma.agent.create({
        data: { projectId: personal.projects[0]!.id, name: "Juno", jobTitle: "Social media manager", personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
      });
      await saveConnection({ organizationId: personal.id, connectorId: "x", tokens: { accessToken: "mine", extra: { userId: "u2" } }, account: "@me" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL, init?: RequestInit) => {
          calls.push({ method: init?.method ?? "GET", url: String(input), body: String(init?.body ?? ""), headers: new Headers(init?.headers) });
          return json({ data: { id: "1600", text: "ok" } }, 201);
        }),
      );
      const item = await prisma.actionItem.create({ data: { organizationId: personal.id, agentId: me.id, type: "scope_run", trigger: "manual", payload: {} } });
      const ctx: RunContext = { ...(await run()), actionItemId: item.id, organizationId: personal.id, agent: { id: me.id, name: "Juno", modelProvider: "anthropic", model: null } };
      const id = draftId((await tool(ctx, "draft_content", { kind: "social_caption", title: "Weekend", body: "Finished my first 10k today.", platform: "X" })).content);
      expect((await tool(ctx, "publish_post", { draft_id: id })).gate?.tool).toBe("publish_post");
      expect(calls).toHaveLength(0);
      const pending = await prisma.actionItem.findUniqueOrThrow({ where: { id: item.id } });
      const delivery = await executePendingAction(item.id, personal.id, pending.pendingAction as unknown as PendingAction);
      expect(delivery.ok).toBe(true);
      expect(calls[0]!.url).toBe("https://api.x.com/2/tweets");
      expect(calls[0]!.headers.get("authorization")).toBe("Bearer mine");
    } finally {
      await prisma.organization.delete({ where: { id: personal.id } }).catch(() => {});
    }
  });
});
