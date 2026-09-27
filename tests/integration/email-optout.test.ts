/**
 * Anti-spam rules on agent email: no postal address, no send; the footer and
 * one-click headers on every email; anyone who unsubscribed is skipped; the
 * unsubscribe endpoint records the opt-out from a signed link only.
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
import { optOutToken } from "@/lib/email-optout";
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
  it("refuses to send until the business has a postal address", async () => {
    const result = await email(["a@example.com"]);
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/postal address/);
    expect(sent).toHaveLength(0);
  });

  it("adds the sender, address and a one-click unsubscribe to every email", async () => {
    await prisma.organization.update({ where: { id: organizationId }, data: { mailingAddress: "12 Sukhumvit Soi 11\nBangkok 10110" } });
    const result = await email(["a@example.com"]);
    expect(result.ok).toBe(true);
    const message = sent.at(-1)!;
    expect(message.text).toContain("We now open on Saturdays.");
    expect(message.text).toContain(`Sent by Northwind ${stamp}, 12 Sukhumvit Soi 11, Bangkok 10110.`);
    expect(message.text).toMatch(/To stop receiving emails .*https:\/\/desker\.test\/unsubscribe\//);
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // The mail app's own Unsubscribe button: a one-click POST to the header URL.
    const url = message.headers!["List-Unsubscribe"]!.slice(1, -1);
    const token = url.split("/").at(-1)!;
    const body = new FormData();
    body.set("List-Unsubscribe", "One-Click");
    const response = await unsubscribe(new Request(url, { method: "POST", body }), { params: Promise.resolve({ token }) });
    expect(response.status).toBe(200);

    // From now on that address is skipped, and alone it means nothing is sent.
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
