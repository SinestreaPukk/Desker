/**
 * Forgot password, end to end at the library level: the same answer for any
 * address, one hashed one-hour link per request, single use, and every open
 * link spent once the password changes. Needs DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const sent = vi.hoisted(() => [] as { to: string; text: string }[]);
vi.mock("@/lib/platform/app-email", () => ({ sendAppEmailLater: (message: { to: string; text: string }) => sent.push(message) }));
// The sign-in library does not load under the test runner; only hashing is needed.
vi.mock("@/lib/auth/auth", () => ({ hashPassword: async (password: string) => `test-hash:${password}` }));

import { requestPasswordReset, resetLinkUsable, resetPassword } from "@/lib/auth/password-reset";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const email = `reset-${stamp}@example.com`;
let userId: string;

const tokenFrom = (text: string) => text.match(/reset-password\/([A-Za-z0-9_-]+)/)![1]!;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email, passwordHash: "old", firstName: "Rae" } })).id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("forgot password", () => {
  it("says nothing and sends nothing for an address with no account", async () => {
    await requestPasswordReset(`nobody-${stamp}@example.com`, "https://desker.test");
    expect(sent).toHaveLength(0);
  });

  it("emails a one-hour link, stores only its hash, and works exactly once", async () => {
    await requestPasswordReset(email.toUpperCase(), "https://desker.test");
    await requestPasswordReset(email, "https://desker.test");
    expect(sent).toHaveLength(2);
    expect(sent[0]!.to).toBe(email);
    expect(sent[0]!.text).toMatch(/^Hi Rae,/);
    const first = tokenFrom(sent[0]!.text);
    const second = tokenFrom(sent[1]!.text);

    const rows = await prisma.passwordReset.findMany({ where: { userId } });
    expect(rows.every((row) => row.tokenHash !== first && row.tokenHash !== second)).toBe(true);
    expect(rows.every((row) => row.expiresAt.getTime() - Date.now() <= 60 * 60_000 + 1000)).toBe(true);

    expect(await resetLinkUsable(second)).toBe(true);
    expect(await resetPassword(second, "a-new-password")).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).toBe("test-hash:a-new-password");
    expect(user.passwordChangedAt).not.toBeNull();

    // Spent, and so is the other link that was still open.
    expect(await resetPassword(second, "again-password")).toBe(false);
    expect(await resetPassword(first, "again-password")).toBe(false);
  });

  it("refuses an expired link", async () => {
    await requestPasswordReset(email, "https://desker.test");
    const token = tokenFrom(sent.at(-1)!.text);
    await prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resetLinkUsable(token)).toBe(false);
    expect(await resetPassword(token, "late-password")).toBe(false);
  });

  it("stops after three emails an hour to one address", async () => {
    const before = sent.length;
    await requestPasswordReset(email, "https://desker.test");
    expect(sent.length).toBe(before); // the fourth request this hour
  });
});
