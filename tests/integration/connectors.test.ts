/**
 * The connector tools end to end against a real database, with the providers'
 * HTTP APIs faked: what an agent gets when nothing is connected, how an
 * expired Google token is refreshed and resealed, and how a calendar event or
 * Slack message goes through the same approval gate as an email.
 *
 * Needs DATABASE_URL and VAULT_KEY. No provider credentials, no network.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { executePendingAction, executeWorkTool, type RunContext } from "@/lib/work/execute";
import { saveConnection } from "@/lib/integrations/oauth";
import { open } from "@/lib/vault";
import type { PendingAction } from "@/lib/work/types";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;

/** Every provider call the test expects, answered locally; anything else fails loudly. */
const calls: { url: string; auth: string | null; body: string | null }[] = [];
function fakeProviders() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, auth: headers.get("authorization"), body: typeof init?.body === "string" ? init.body : String(init?.body ?? "") });
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
      if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "fresh-google", expires_in: 3600 });
      if (url.includes("/calendar/v3/calendars/primary/events") && init?.method === "POST") return json({ id: "evt1" });
      if (url.includes("/calendar/v3/calendars/primary/events")) {
        return json({ items: [{ summary: "Board call", start: { dateTime: "2026-10-01T09:00:00Z" }, end: { dateTime: "2026-10-01T10:00:00Z" } }] });
      }
      if (url === "https://slack.com/api/chat.postMessage") return json({ ok: true, ts: "1" });
      if (url.includes("api.github.com/repos/acme/app/contents/README.md")) {
        return json({ content: Buffer.from("# Acme app\nRun npm start.").toString("base64") });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    }),
  );
}

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = "test-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  const org = await prisma.organization.create({
    data: { name: `Connectors ${stamp}`, slug: `connectors-${stamp}`, projects: { create: { name: "C", slug: `connectors-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Sam",
      jobTitle: "Executive Assistant",
      personality: "Plain.",
      responsibilities: [],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

async function run(autonomy: "draft_only" | "auto" = "draft_only"): Promise<RunContext> {
  const item = await prisma.actionItem.create({
    data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} },
  });
  return {
    actionItemId: item.id,
    organizationId,
    agent: { id: agentId, name: "Sam", modelProvider: "anthropic", model: null },
    autonomy,
    toolAutonomy: null,
    tools: ["calendar_list_events", "calendar_create_event", "slack_post_message", "github_read"],
    documentIds: [],
    trigger: "manual",
  };
}

const tool = (ctx: RunContext, name: string, input: Record<string, unknown>) =>
  executeWorkTool({ id: `call-${Math.random()}`, name, input }, ctx);

describe("connector tools", () => {
  it("tell the agent plainly when nothing is connected, without touching the network", async () => {
    fakeProviders();
    const ctx = await run();
    for (const [name, input] of [
      ["calendar_list_events", { from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" }],
      ["slack_post_message", { channel: "#general", text: "hi" }],
      ["github_read", { action: "list_repos" }],
    ] as const) {
      const outcome = await tool(ctx, name, input);
      expect(outcome.isError, name).toBe(true);
      expect(outcome.content, name).toMatch(/not connected.*say plainly in your report/);
    }
    expect(calls).toHaveLength(0);
  });

  it("refresh an expired Google token, reseal it, and read the calendar", async () => {
    await saveConnection({
      organizationId,
      connectorId: "google_calendar",
      tokens: { accessToken: "stale", refreshToken: "refresh-me", expiresAt: Date.now() - 1000 },
      account: "sam@acme.example",
    });
    fakeProviders();
    const outcome = await tool(await run(), "calendar_list_events", {
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-02T00:00:00Z",
    });
    expect(outcome.content).toMatch(/Board call/);
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["oauth2.googleapis.com", "www.googleapis.com"]);
    expect(calls[1]!.auth).toBe("Bearer fresh-google");

    const row = await prisma.integration.findFirstOrThrow({ where: { organizationId, type: "google_calendar" } });
    const sealed = open<{ accessToken: string; refreshToken: string }>(row.secret!);
    expect(sealed).toMatchObject({ accessToken: "fresh-google", refreshToken: "refresh-me" });
    expect(row.secret).not.toContain("fresh-google");
  });

  it("hold a calendar event for approval, then create it once approved", async () => {
    fakeProviders();
    const ctx = await run("draft_only");
    const outcome = await tool(ctx, "calendar_create_event", {
      summary: "Intro with Priya",
      start: "2026-10-02T09:00:00Z",
      end: "2026-10-02T09:30:00Z",
      attendees: "priya@acme.example",
    });
    expect(outcome.gate?.tool).toBe("calendar_create_event");
    expect(calls.filter((c) => c.url.includes("calendar"))).toHaveLength(0);

    const item = await prisma.actionItem.findUniqueOrThrow({ where: { id: ctx.actionItemId } });
    const delivery = await executePendingAction(ctx.actionItemId, organizationId, item.pendingAction as unknown as PendingAction);
    expect(delivery.ok).toBe(true);
    const post = calls.find((c) => c.url.includes("/events") && c.body?.includes("Intro with Priya"));
    expect(post?.body).toContain("priya@acme.example");
  });

  it("post to Slack straight away in auto mode", async () => {
    await saveConnection({ organizationId, connectorId: "slack", tokens: { accessToken: "xoxb-test" }, account: "Acme workspace" });
    fakeProviders();
    const outcome = await tool(await run("auto"), "slack_post_message", { channel: "#general", text: "Weekly update" });
    expect(outcome.isError).toBeFalsy();
    expect(outcome.content).toMatch(/Posted to #general/);
    expect(calls[0]!.auth).toBe("Bearer xoxb-test");
  });

  it("read a file from GitHub, and refuse a malformed repository name", async () => {
    await saveConnection({ organizationId, connectorId: "github", tokens: { accessToken: "gh-test" }, account: "@sam" });
    fakeProviders();
    const ctx = await run();
    const file = await tool(ctx, "github_read", { action: "read_file", repo: "acme/app", path: "README.md" });
    expect(file.content).toContain("Run npm start.");
    const bad = await tool(ctx, "github_read", { action: "read_file", repo: "../../etc", path: "passwd" });
    expect(bad.isError).toBe(true);
  });
});
