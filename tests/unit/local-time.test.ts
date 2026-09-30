import { describe, expect, it } from "vitest";
import { localIso, offsetOf, timeNote, validTimeZone } from "@/lib/local-time";
import { describeEvents } from "@/lib/integrations/mail-calendar";

const at = new Date("2026-09-30T13:45:00Z");

describe("times in the owner's zone", () => {
  it("writes the local wall-clock time with its offset", () => {
    expect(localIso(at, "Asia/Bangkok")).toBe("2026-09-30T20:45+07:00");
    expect(localIso(at, "Asia/Kolkata")).toBe("2026-09-30T19:15+05:30");
    expect(offsetOf(at, "America/New_York")).toBe("-04:00");
    // The same instant, so a time handed back to a tool means what it said.
    expect(Date.parse(localIso(at, "Asia/Bangkok"))).toBe(at.getTime());
  });

  it("falls back to UTC for a zone it doesn't know", () => {
    expect(validTimeZone("Not/AZone")).toBe("UTC");
    expect(validTimeZone(null)).toBe("UTC");
  });

  it("tells the agent now, in the owner's zone", () => {
    expect(timeNote(at, "Asia/Bangkok")).toContain("Wednesday, 30 September 2026, 20:45");
    expect(timeNote(at, "Asia/Bangkok")).toContain("UTC+07:00");
  });

  it("shows calendar events in the owner's zone", () => {
    const text = describeEvents(
      [{ id: "e1", seriesId: null, title: "Standup", start: "2026-10-05T02:00:00Z", end: "2026-10-05T02:30:00Z", allDay: false, attendees: [] }],
      "Asia/Bangkok",
    );
    expect(text).toContain("2026-10-05T09:00+07:00 → 2026-10-05T09:30+07:00: Standup");
  });
});
