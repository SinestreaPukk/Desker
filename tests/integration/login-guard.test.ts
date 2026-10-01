/**
 * The sign-in guard against a real database: five wrong passwords lock an
 * account (and tell its owner once), an unknown address locks the same way so
 * a lock reveals nothing, a good password clears the count, and a sign-in
 * from a new device is emailed - but never the very first one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const sent = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("@/lib/app-email", () => ({
  sendAppEmailLater: (message: { to: string; subject: string }) => sent.push(message),
}));

import { noteDevice, signInBlocked, signInFailed, signInSucceeded } from "@/lib/login-guard";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const email = `guard-${stamp}@example.test`;
let userId: string;

const request = (userAgent: string) => new Request("https://desker.test/api/auth", { headers: { "user-agent": userAgent, "x-forwarded-for": `10.0.0.${stamp.length}` } });
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1";

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email, passwordHash: "x", firstName: "Sam" } })).id;
});

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  await prisma.rateLimitWindow.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("wrong passwords", () => {
  it("lock the account after five, email the owner once, and clear on a good sign-in", async () => {
    const owner = { email, firstName: "Sam" };
    for (let i = 0; i < 4; i++) await signInFailed(email, owner);
    expect(await signInBlocked(email, `ip-${stamp}`)).toBeNull();
    await signInFailed(email, owner);
    expect(await signInBlocked(email, `ip-${stamp}`)).toBeGreaterThan(0);
    expect(sent.filter((m) => m.subject.includes("paused"))).toHaveLength(1);

    await signInSucceeded(email);
    expect(await signInBlocked(email, `ip-${stamp}`)).toBeNull();
  });

  it("lock an address with no account the same way, so a lock reveals nothing", async () => {
    const nobody = `nobody-${stamp}@example.test`;
    for (let i = 0; i < 5; i++) await signInFailed(nobody, null);
    expect(await signInBlocked(nobody, `ip2-${stamp}`)).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
  });
});

describe("new devices", () => {
  it("only remembers the first sign-in, then emails one from a device it hasn't seen", async () => {
    const user = () => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, firstName: true, knownDevices: true } });
    await noteDevice(await user(), request(MAC_CHROME));
    expect(sent).toHaveLength(0);
    await noteDevice(await user(), request(MAC_CHROME));
    expect(sent).toHaveLength(0);
    await noteDevice(await user(), request(IPHONE));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe("New sign-in to Desker: Safari on iOS");
    expect(sent[0]!.to).toBe(email);
  });
});
