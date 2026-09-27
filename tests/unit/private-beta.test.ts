import { describe, expect, it } from "vitest";
import { mayUsePlatform } from "@/lib/private-beta";

describe("mayUsePlatform", () => {
  it("lets in only the listed addresses, whatever their case or spacing", () => {
    const list = " owner@example.com , tester@example.com ";
    expect(mayUsePlatform("Owner@Example.com", list)).toBe(true);
    expect(mayUsePlatform("tester@example.com", list)).toBe(true);
    expect(mayUsePlatform("stranger@example.com", list)).toBe(false);
  });

  it("is open when no list is set", () => {
    expect(mayUsePlatform("anyone@example.com", "")).toBe(true);
    expect(mayUsePlatform("anyone@example.com", undefined)).toBe(true);
  });
});
