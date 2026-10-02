import { describe, expect, it } from "vitest";
import {
  ESCALATION_OPTIONS,
  STAKEHOLDER_OPTIONS,
  composeChoices,
  composeEscalation,
  defaultPersonality,
  parseChoices,
  parseEscalation,
} from "@/lib/work/agent-choices";
import { shownAgentQuestions } from "@/lib/work/context";

describe("ticked answers", () => {
  it("round-trips an escalation rule through ticks", () => {
    const picked = { selected: [ESCALATION_OPTIONS[0]!, ESCALATION_OPTIONS[1]!], other: "anything over $200" };
    const rule = composeEscalation(picked);
    expect(rule).toBe(
      "Stop and ask a person when: paying, buying or signing anything; agreeing to a date or plan on my behalf; anything over $200.",
    );
    expect(parseEscalation(rule)).toEqual(picked);
  });

  it("never ends a rule with two full stops", () => {
    expect(composeEscalation({ selected: [], other: "Escalate if pricing comes up." })).toBe("Stop and ask a person when: Escalate if pricing comes up.");
  });

  it("keeps a rule written in the owner's own words, word for word", () => {
    const rule = "Escalate if it mentions legal action.";
    expect(parseEscalation(rule)).toEqual({ selected: [], other: rule });
  });

  it("reads who is involved back into chips plus the owner's own words", () => {
    const text = composeChoices({ selected: ["Just me", "My partner"], other: "Sam pays half the rent" });
    expect(parseChoices(text, STAKEHOLDER_OPTIONS)).toEqual({ selected: ["Just me", "My partner"], other: "Sam pays half the rent" });
  });

  it("gives every agent a voice without anyone writing one", () => {
    expect(defaultPersonality().length).toBeGreaterThan(20);
  });

  it("stops asking 'never', but keeps an answer someone already wrote", () => {
    expect(shownAgentQuestions({}).map((q) => q.id)).not.toContain("never");
    expect(shownAgentQuestions({ never: "Never suggest a loan" }).map((q) => q.id)).toContain("never");
  });
});
