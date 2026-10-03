/**
 * The beta list: a request is kept and the owner is emailed; a bad address
 * is refused by name; a bot filling the honeypot learns nothing and leaves
 * nothing behind. Needs DATABASE_URL.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const sent = vi.hoisted(() => [] as { subject: string; text: string }[]);
vi.mock("@/lib/platform/app-email", () => ({ emailOwner: (message: { subject: string; text: string }) => sent.push(message) }));
// The sign-in library does not load under the test runner, and this route never asks who you are.
vi.mock("@/lib/auth/auth", () => ({}));

import { POST } from "@/app/api/beta/route";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const post = (body: object, ip: string) =>
  // As the form sends it: opened a few seconds before it was sent.
  POST(new Request("http://desker.test/api/beta", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ startedAt: Date.now() - 5000, ...body }) }));

afterAll(async () => {
  await prisma.feedback.deleteMany({ where: { kind: "beta", message: { contains: stamp } } });
  await prisma.$disconnect();
});

describe("the beta list", () => {
  it("keeps the request and emails the owner", async () => {
    const response = await post({ email: ` Beta-${stamp}@Example.com `, firstHire: "Marketer" }, `10.${stamp}.1`);
    expect(response.status).toBe(200);
    const row = await prisma.feedback.findFirstOrThrow({ where: { kind: "beta", message: { contains: stamp } } });
    expect(row.message).toBe(`Email: beta-${stamp}@example.com\nWould hire first: Marketer`);
    expect(sent.at(-1)!.subject).toBe(`Beta request from beta-${stamp}@example.com`);
  });

  it("refuses an address that isn't one", async () => {
    const response = await post({ email: "not-an-email" }, `10.${stamp}.2`);
    expect(response.status).toBe(422);
  });

  it("drops a filled honeypot without telling the bot", async () => {
    const before = sent.length;
    const response = await post({ email: `bot-${stamp}@example.com`, website: "spam.example" }, `10.${stamp}.3`);
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(before);
    expect(await prisma.feedback.count({ where: { message: { contains: `bot-${stamp}` } } })).toBe(0);
  });
});
