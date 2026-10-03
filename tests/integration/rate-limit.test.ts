/**
 * The shared rate limiter, against a real database: the same limit whichever
 * instance a request lands on, and exact under a burst of simultaneous calls.
 *
 * Needs DATABASE_URL only.
 */
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { OrganizationRateLimited, checkRateLimit, limitOrganization } from "@/lib/platform/rate-limit";

const prisma = new PrismaClient();
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const key = (name: string) => `test:${stamp}:${name}`;

afterAll(async () => {
  await prisma.rateLimitWindow.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.$disconnect();
});

describe("checkRateLimit", () => {
  it("allows up to the limit, counting down, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(key("a"), 3, 60_000));
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent, so one caller cannot exhaust another", async () => {
    await checkRateLimit(key("b"), 1, 60_000);
    expect((await checkRateLimit(key("b"), 1, 60_000)).allowed).toBe(false);
    expect((await checkRateLimit(key("c"), 1, 60_000)).allowed).toBe(true);
  });

  it("opens a fresh window once the old one expires", async () => {
    expect((await checkRateLimit(key("d"), 1, 50)).allowed).toBe(true);
    expect((await checkRateLimit(key("d"), 1, 50)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await checkRateLimit(key("d"), 1, 50)).allowed).toBe(true);
  });

  it("admits exactly the limit when a burst arrives at once", async () => {
    const burst = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key("burst"), 5, 60_000)));
    expect(burst.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("limitOrganization", () => {
  it("throws a plain-language refusal once an organisation passes its fair share", async () => {
    const org = `org-${stamp}`;
    await expect(
      (async () => {
        for (let i = 0; i < 500; i++) await limitOrganization(org, "runs");
      })(),
    ).rejects.toBeInstanceOf(OrganizationRateLimited);
    // A different organisation is unaffected.
    await expect(limitOrganization(`other-${stamp}`, "runs")).resolves.toBeUndefined();
  });
});
