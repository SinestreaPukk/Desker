import { describe, expect, it } from "vitest";
import { conflictsWith, describeEvents, gmailReplyRaw, shiftedSeries, type CalendarEvent } from "@/lib/integrations/mail-calendar";
import { connectorChoice, connectorsForTool } from "@/lib/integrations/catalog";
import { describeBoundaries } from "@/lib/work/boundaries";

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  seriesId: null,
  title: "Standup",
  start: "2026-10-05T09:00:00Z",
  end: "2026-10-05T09:30:00Z",
  allDay: false,
  attendees: [],
  ...over,
});

describe("the calendar", () => {
  it("finds a clash, but not with the event being moved, an all-day event, or one that only touches", () => {
    const events = [
      event({ id: "a" }),
      event({ id: "b", start: "2026-10-05T09:30:00Z", end: "2026-10-05T10:00:00Z" }),
      event({ id: "c", allDay: true, start: "2026-10-05", end: "2026-10-06" }),
    ];
    expect(conflictsWith(events, "2026-10-05T09:15:00Z", "2026-10-05T09:30:00Z").map((e) => e.id)).toEqual(["a"]);
    expect(conflictsWith(events, "2026-10-05T09:15:00Z", "2026-10-05T09:30:00Z", "a")).toEqual([]);
  });

  it("moves a whole series by the amount its occurrence moves", () => {
    const moved = shiftedSeries(
      { start: "2026-09-07T09:00:00Z", end: "2026-09-07T09:30:00Z" },
      { start: "2026-10-05T09:00:00Z" },
      "2026-10-05T10:30:00Z",
    );
    expect(moved).toEqual({ start: "2026-09-07T10:30:00.000Z", end: "2026-09-07T11:00:00.000Z" });
  });

  it("gives the model each event's id, and the series id of a repeating one", () => {
    expect(describeEvents([event({ id: "x_1", seriesId: "x" })])).toContain("[id: x_1; repeats, series id: x]");
  });
});

describe("a Gmail reply", () => {
  it("threads under the message it answers, and encodes a subject in any language", () => {
    const raw = gmailReplyRaw({ to: "jo@example.com", subject: "สวัสดี", messageId: "<m1@mail>", references: "<m0@mail>", body: "Hi Jo" });
    const text = Buffer.from(raw, "base64url").toString("utf8");
    expect(text).toContain("In-Reply-To: <m1@mail>");
    expect(text).toContain("References: <m0@mail> <m1@mail>");
    expect(text).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(text.endsWith("\r\n\r\nHi Jo")).toBe(true);
  });

  it("does not stack Re: on a subject that already has one", () => {
    const text = Buffer.from(gmailReplyRaw({ to: "a@b.co", subject: "Re: Quote", messageId: "", references: "", body: "x" }), "base64url").toString("utf8");
    expect(text).toContain("Subject: Re: Quote\r\n");
    expect(text).not.toContain("In-Reply-To");
  });
});

describe("mail and calendar connectors", () => {
  it("serve each tool from Google or Microsoft", () => {
    expect(connectorChoice(connectorsForTool("inbox_reply"))).toBe("Gmail or Outlook mail");
    expect(connectorsForTool("calendar_reschedule").map((c) => c.id)).toEqual(["google_calendar", "outlook_calendar"]);
  });

  it("say on the agent's card that a reply or a move waits for approval", () => {
    const { can, cannot } = describeBoundaries({ tools: ["inbox_read", "inbox_reply", "calendar_reschedule"], autonomy: "draft_only", toolAutonomy: null });
    expect(can).toContain("Read your inbox");
    expect(cannot).toContain("Reply to emails without your approval");
    expect(cannot).toContain("Move calendar events without your approval");
  });
});
