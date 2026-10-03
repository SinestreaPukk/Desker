import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform/db", () => ({ prisma: {} }));
import { isSpike } from "@/lib/work/watchdog";

describe("isSpike", () => {
  it("fires well above the usual rate", () => {
    expect(isSpike(40, 5, 10)).toBe(true);
  });
  it("ignores a quiet platform going from nothing to a handful", () => {
    expect(isSpike(4, 0, 10)).toBe(false);
  });
  it("ignores a busy platform being busy", () => {
    expect(isSpike(30, 12, 10)).toBe(false);
  });
});
