import { describe, expect, it } from "vitest";
import { NEEDS_YOU_KINDS, needsYouKind, waitingCount } from "@/lib/needs-you";

describe("Needs you", () => {
  it("sorts every raised issue into one of the queue's kinds", () => {
    expect(needsYouKind({ type: "escalation" })).toBe("escalation");
    expect(needsYouKind({ type: "failure" })).toBe("failure");
    expect(needsYouKind({ type: "issue" })).toBe("reported");
    expect(needsYouKind({ type: "suggestion" })).toBe("reported");
  });

  it("puts approvals first: a paused run is the most urgent thing", () => {
    expect(NEEDS_YOU_KINDS[0]).toBe("approval");
  });

  it("counts the same three sources the queue lists", () => {
    expect(waitingCount({ approvals: 2, openIssues: 3, pendingSuggestions: 1 })).toBe(6);
  });
});
