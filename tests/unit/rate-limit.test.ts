import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit then refuses", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts down the remaining allowance", () => {
    expect(checkRateLimit("k", 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit("k", 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit("k", 3, 60_000).remaining).toBe(0);
  });

  it("keys are independent, so one session cannot exhaust another", () => {
    checkRateLimit("a", 1, 60_000);
    expect(checkRateLimit("a", 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 60_000).allowed).toBe(true);
  });

  it("opens a fresh window once the old one expires", async () => {
    expect(checkRateLimit("k", 1, 20).allowed).toBe(true);
    expect(checkRateLimit("k", 1, 20).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(checkRateLimit("k", 1, 20).allowed).toBe(true);
  });
});
