import { describe, expect, it } from "vitest";
import { isWithinQuietHours } from "@/lib/triggers/engine";

describe("proactive triggers", () => {
  it("calculates quiet hours overnight window correctly", () => {
    // 23:30 is inside 22:00-07:00
    const lateNight = new Date("2026-10-04T23:30:00Z");
    expect(isWithinQuietHours(lateNight, "UTC", "22:00", "07:00")).toBe(true);

    // 03:15 is inside 22:00-07:00
    const earlyMorning = new Date("2026-10-04T03:15:00Z");
    expect(isWithinQuietHours(earlyMorning, "UTC", "22:00", "07:00")).toBe(true);

    // 14:00 is outside 22:00-07:00
    const daytime = new Date("2026-10-04T14:00:00Z");
    expect(isWithinQuietHours(daytime, "UTC", "22:00", "07:00")).toBe(false);

    // 08:30 is outside 22:00-07:00
    const morning = new Date("2026-10-04T08:30:00Z");
    expect(isWithinQuietHours(morning, "UTC", "22:00", "07:00")).toBe(false);
  });

  it("handles daytime quiet window correctly", () => {
    const noon = new Date("2026-10-04T12:30:00Z");
    expect(isWithinQuietHours(noon, "UTC", "12:00", "13:00")).toBe(true);

    const evening = new Date("2026-10-04T18:00:00Z");
    expect(isWithinQuietHours(evening, "UTC", "12:00", "13:00")).toBe(false);
  });
});
