/**
 * Email and calendar through Gmail and Outlook, end to end against a real
 * database with the providers faked at the network edge: a reply is drafted
 * in the real thread and sent only on approval (with the owner's edit), a
 * rejection deletes the draft, a clashing time is refused, and a repeating
 * Outlook event moves as a whole series. Needs DATABASE_URL and VAULT_KEY.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));
const session = vi.hoisted(() => ({ user: { id: "", email: "" } }));
vi.mock("@/lib/auth", () => ({ currentUser: vi.fn(async () => session.user) }));

import { executePendingAction, executeWorkTool, type RunContext } from "@/lib/work/execute";
import { saveConnection } from "@/lib/integrations/oauth";
import { POST as reject } from "@/app/api/action-items/[actionItemId]/reject/route";
import type { PendingAction } from "@/lib/work/types";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let agentId: string;

const calls: { method: string; url: string; body: string }[] = [];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
function fake() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: typeof init?.body === "string" ? init.body : "" });
      // Gmail
      if (url.includes("gmail.googleapis.com") && url.includes("/threads/t1?format=metadata")) {
        return json({
          messages: [
            {
              payload: {
                headers: [
                  { name: "From", value: "Jo <jo@example.com>" },
                  { name: "Subject", value: "Quote for 40 drills" },
                  { name: "Message-ID", value: "<m1@mail.example>" },
                ],
              },
            },
          ],
        });
      }
      if (url.endsWith("/users/me/drafts") && method === "POST") return json({ id: "d1" });
      if (url.endsWith("/users/me/drafts/d1") && method === "PUT") return json({ id: "d1" });
      if (url.endsWith("/users/me/drafts/send")) return json({ id: "sent1" });
      if (url.endsWith("/users/me/drafts/d1") && method === "DELETE") return new Response(null, { status: 204 });
      // Outlook calendar
      if (url.includes("graph.microsoft.com/v1.0/me/calendarView")) {
        return json({
          value: [
            { id: "occ1", seriesMasterId: "series1", subject: "Weekly 1:1", start: { dateTime: "2026-10-05T09:00:00.0000000" }, end: { dateTime: "2026-10-05T09:30:00.0000000" } },
            { id: "busy", subject: "Board call", start: { dateTime: "2026-10-05T11:00:00.0000000" }, end: { dateTime: "2026-10-05T12:00:00.0000000" } },
          ],
        });
      }
      if (url.includes("/me/events/series1") && method === "GET") {
        return json({ start: { dateTime: "2026-09-07T09:00:00.0000000" }, end: { dateTime: "2026-09-07T09:30:00.0000000" } });
      }
      if (url.includes("/me/events/occ1") && method === "GET") {
        return json({ start: { dateTime: "2026-10-05T09:00:00.0000000" }, end: { dateTime: "2026-10-05T09:30:00.0000000" } });
      }
      if (url.includes("/me/events/series1") && method === "PATCH") return json({ id: "series1" });
      throw new Error(`Unexpected request in test: ${method} ${url}`);
    }),
  );
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `mc-${stamp}@example.com`, passwordHash: "x" } });
  session.user = { id: user.id, email: user.email };
  const org = await prisma.organization.create({
    data: {
      name: `MC ${stamp}`,
      slug: `mc-${stamp}`,
      memberships: { create: { userId: user.id, role: "owner" } },
      projects: { create: { name: "MC", slug: `mc-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  agentId = (
    await prisma.agent.create({
      data: { projectId: org.projects[0]!.id, name: "Kai", jobTitle: "Executive Assistant", personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
    })
  ).id;
  const far = Date.now() + 3_600_000;
  await saveConnection({ organizationId, connectorId: "gmail", tokens: { accessToken: "g", expiresAt: far }, account: "owner@gmail.example" });
  await saveConnection({ organizationId, connectorId: "outlook_calendar", tokens: { accessToken: "m", expiresAt: far }, account: "owner@outlook.example" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: `mc-${stamp}@example.com` } });
  await prisma.$disconnect();
});

async function run(): Promise<RunContext> {
  const item = await prisma.actionItem.create({ data: { organizationId, agentId, type: "scope_run", trigger: "manual", payload: {} } });
  return {
    actionItemId: item.id,
    organizationId,
    agent: { id: agentId, name: "Kai", modelProvider: "anthropic", model: null },
    autonomy: "draft_only",
    toolAutonomy: null,
    tools: ["inbox_read", "inbox_reply", "calendar_list_events", "calendar_create_event", "calendar_reschedule"],
    documentIds: [],
    trigger: "manual",
  };
}
const tool = (ctx: RunContext, name: string, input: Record<string, unknown>) => executeWorkTool({ id: `c-${Math.random()}`, name, input }, ctx);

describe("replying in a Gmail thread", () => {
  it("drafts in the thread straight away, and sends the owner's edited text only once approved", async () => {
    fake();
    const ctx = await run();
    const outcome = await tool(ctx, "inbox_reply", { thread_id: "t1", body: "Hi Jo, the quote is attached." });
    expect(outcome.gate?.tool).toBe("inbox_reply");
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/drafts"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/drafts/send"))).toBe(false);
    const created = JSON.parse(calls.find((c) => c.url.endsWith("/drafts"))!.body) as { message: { raw: string; threadId: string } };
    expect(created.message.threadId).toBe("t1");
    expect(Buffer.from(created.message.raw, "base64url").toString("utf8")).toContain("In-Reply-To: <m1@mail.example>");

    // The owner edits the reply in Needs you, then approves.
    const item = await prisma.actionItem.findUniqueOrThrow({ where: { id: ctx.actionItemId } });
    const action = item.pendingAction as unknown as PendingAction;
    await prisma.draft.update({ where: { id: action.draftId! }, data: { body: "Hi Jo - quote attached, valid for 30 days." } });
    const delivery = await executePendingAction(ctx.actionItemId, organizationId, action);
    expect(delivery.ok).toBe(true);
    const put = calls.find((c) => c.method === "PUT")!;
    expect(Buffer.from((JSON.parse(put.body) as { message: { raw: string } }).message.raw, "base64url").toString("utf8")).toContain("valid for 30 days");
    expect(calls.some((c) => c.url.endsWith("/drafts/send"))).toBe(true);
  });

  it("deletes the mailbox draft when the reply is rejected", async () => {
    fake();
    const ctx = await run();
    await tool(ctx, "inbox_reply", { thread_id: "t1", body: "Hi Jo" });
    await prisma.actionItem.update({ where: { id: ctx.actionItemId }, data: { status: "needs_approval" } });
    const response = await reject(
      new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Not now" }) }),
      { params: Promise.resolve({ actionItemId: ctx.actionItemId }) },
    );
    expect(response.status).toBe(200);
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/drafts/d1"))).toBe(true);
  });
});

describe("an Outlook calendar", () => {
  it("refuses a time that clashes, and moves a whole repeating series once approved", async () => {
    fake();
    const ctx = await run();
    const clash = await tool(ctx, "calendar_reschedule", {
      event_id: "occ1",
      series_id: "series1",
      whole_series: true,
      start: "2026-10-05T11:30:00Z",
      end: "2026-10-05T12:00:00Z",
    });
    expect(clash.isError).toBe(true);
    expect(clash.content).toMatch(/clashes with "Board call"/);

    const ok = await tool(ctx, "calendar_reschedule", {
      event_id: "occ1",
      series_id: "series1",
      whole_series: true,
      start: "2026-10-05T10:00:00Z",
      end: "2026-10-05T10:30:00Z",
    });
    expect(ok.gate?.tool).toBe("calendar_reschedule");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    const item = await prisma.actionItem.findUniqueOrThrow({ where: { id: ctx.actionItemId } });
    const delivery = await executePendingAction(ctx.actionItemId, organizationId, item.pendingAction as unknown as PendingAction);
    expect(delivery.ok).toBe(true);
    const patch = JSON.parse(calls.find((c) => c.method === "PATCH")!.body) as { start: { dateTime: string } };
    // The series started 7 Sep at 09:00; moving this occurrence an hour later moves them all an hour later.
    expect(patch.start.dateTime).toBe("2026-09-07T10:00:00");
  });
});
