import { describe, expect, it } from "vitest";
import { costOf, priceFor } from "@/lib/pricing";

describe("pricing", () => {
  it("prices a known model per million tokens", () => {
    expect(costOf("claude-sonnet-4-6", 1_000_000, 0)).toBe(3);
    expect(costOf("claude-sonnet-4-6", 0, 1_000_000)).toBe(15);
    expect(costOf("claude-opus-5", 10_000, 1_000)).toBeCloseTo(0.05 + 0.025, 6);
  });
  it("ignores a date suffix and reports unknown models as null, never zero", () => {
    expect(priceFor("claude-sonnet-4-6-20260101")).toEqual(priceFor("claude-sonnet-4-6"));
    expect(costOf("some-unknown-model", 1000, 1000)).toBeNull();
  });
});
