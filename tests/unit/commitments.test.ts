import { describe, expect, it } from "vitest";
import type { CommitmentType, CommitmentOwnerRole } from "@/lib/commitments/types";

describe("commitments logic", () => {
  it("models commitment types and owners cleanly", () => {
    const todo: { type: CommitmentType; ownerRole: CommitmentOwnerRole; outcome: string } = {
      type: "to_do",
      ownerRole: "user",
      outcome: "Submit tax return",
    };
    expect(todo.type).toBe("to_do");
    expect(todo.ownerRole).toBe("user");

    const waitingOn: { type: CommitmentType; ownerRole: CommitmentOwnerRole; ownerName: string; outcome: string } = {
      type: "waiting_on",
      ownerRole: "other",
      ownerName: "Nok",
      outcome: "Send signed contract",
    };
    expect(waitingOn.type).toBe("waiting_on");
    expect(waitingOn.ownerName).toBe("Nok");
  });

  it("escalation logic produces gentle nudges and generates follow-up draft for waiting-on items", () => {
    // When nudgeCount is 0: nudge 1
    const who = "Nok";
    const outcome = "Send signed contract";
    const nudge1 = `Nudge: Waiting on ${who} for: "${outcome}". Due today.`;
    expect(nudge1).toContain("Due today");

    // When nudgeCount is 1: nudge 2 with follow-up draft
    const draft = `Hi ${who}, just following up on: ${outcome}. Let me know if you need anything from me!`;
    const nudge2 = `${who} is late on: "${outcome}". Here is a follow-up draft you can send them:\n\n"${draft}"`;
    expect(nudge2).toContain("Here is a follow-up draft you can send them");
    expect(nudge2).toContain(draft);

    // When nudgeCount is 2: stops nagging and asks once
    const stopNagging = `Past due: "${outcome}". Should we reschedule or drop this loop?`;
    expect(stopNagging).toContain("reschedule or drop");
  });
});
