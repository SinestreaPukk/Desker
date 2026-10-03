/**
 * Opt-outs on agent email: anyone who unsubscribed is skipped; the unsubscribe
 * endpoint records the opt-out from a signed link only. Personal email carries
 * no business footer.
 *
 * Needs DATABASE_URL and AUTH_SECRET. Resend is stubbed with a fetch mock.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Hoisted above the imports: env.ts reads the app URL when it loads.
vi.hoisted(() => {
  process.env.AUTH_SECRET ||= "test-secret-for-email-optout";
  process.env.NEXT_PUBLIC_APP_URL = "https://desker.test";
});

vi.mock("@/lib/work/integrations", async (original) => ({
  ...(await original<typeof import("@/lib/work/integrations")>()),
  resolveEmail: vi.fn(async () => ({ provider: "resend", apiKey: "re_test", from: "hello@northwind.test" })),
}));

import { executePendingAction } from "@/lib/work/execute";
import { optOutToken } from "@/lib/platform/email-optout";
import { POST as unsubscribe } from "@/app/api/unsubscribe/[token]/route";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let actionItemId: string;
let draftId: string;
const sent: { to: string[]; text: string; headers?: Record<string, string> }[] = [];

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `Northwind ${stamp}`, slug: `optout-${stamp}`, projects: { create: { name: "P", slug: `optout-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  const agent = await prisma.agent.create({
    data: { projectId: org.projects[0]!.id, name: "Sam", jobTitle: "SDR", personality: "Plain.", responsibilities: [], allowedTools: [], status: "published" },
  });
  actionItemId = (
    await prisma.actionItem.create({ data: { organizationId, agentId: agent.id, type: "send_email", payload: {} } })
  ).id;
  draftId = (
    await prisma.draft.create({
      data: { organizationId, agentId: agent.id, kind: "email", title: "New opening hours", body: "We now open on Saturdays." },
    })
  ).id;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  }));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

const email = (to: string[]) =>
  executePendingAction(actionItemId, organizationId, { tool: "send_email", input: { to, subject: "New opening hours" }, draftId });

describe("agent email and anti-spam law", () => {
  it("sends the body as written, with no business footer or address demanded", async () => {
    const result = await email(["a@example.com"]);
    expect(result.ok).toBe(true);
    const message = sent.at(-1)!;
    expect(message.text).toBe("We now open on Saturdays.");
    expect(message.headers?.["List-Unsubscribe"]).toBeUndefined();
  });

  it("skips anyone who opted out, and sends nothing when nobody is left", async () => {
    const token = optOutToken(organizationId, "a@example.com");
    const url = `https://desker.test/api/unsubscribe/${token}`;
    const body = new FormData();
    body.set("List-Unsubscribe", "One-Click");
    const response = await unsubscribe(new Request(url, { method: "POST", body }), { params: Promise.resolve({ token }) });
    expect(response.status).toBe(200);

    const before = sent.length;
    const again = await email(["a@example.com"]);
    expect(again.ok).toBe(false);
    expect(again.detail).toMatch(/asked not to receive/);
    expect(sent.length).toBe(before);

    const mixed = await email(["a@example.com", "b@example.com"]);
    expect(mixed.ok).toBe(true);
    expect(sent.at(-1)!.to).toEqual(["b@example.com"]);
    expect(mixed.detail).toMatch(/Skipped a@example.com/);
  });

  it("ignores a forged or tampered unsubscribe link", async () => {
    const good = optOutToken(organizationId, "c@example.com");
    const forged = `${good.split(".")[0]}.not-the-signature`;
    const response = await unsubscribe(new Request(`https://desker.test/api/unsubscribe/${forged}`, { method: "POST" }), {
      params: Promise.resolve({ token: forged }),
    });
    expect(response.status).toBe(400);
    expect(await prisma.emailSuppression.count({ where: { organizationId, email: "c@example.com" } })).toBe(0);
  });
});
