import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { nextSteps, normalizePhoto } from "@/lib/life/photo";
import { withQuickReplies, text } from "@/lib/messaging/line";

describe("photos", () => {
  it("keeps a described photo and falls back to 'other' for an unknown kind", () => {
    expect(normalizePhoto({ kind: "event", summary: "Concert, 12 Dec 19:00, Impact Arena" })).toEqual({ kind: "event", summary: "Concert, 12 Dec 19:00, Impact Arena" });
    expect(normalizePhoto({ kind: "weird", summary: "A cat" })?.kind).toBe("other");
    expect(normalizePhoto({ kind: "event" })).toBeNull();
  });
  it("offers next steps whose labels fit LINE's 20-character quick-reply limit", () => {
    for (const k of ["event", "document", "other", "slip"] as const) for (const l of nextSteps(k)) expect(l.length).toBeLessThanOrEqual(20);
    const m = withQuickReplies(text("hi"), nextSteps("event")) as { quickReply: { items: { action: { text: string } }[] } };
    expect(m.quickReply.items[0]!.action.text).toBe("Add to my calendar");
  });
});
