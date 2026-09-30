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
    const picked = { selected: [ESCALATION_OPTIONS.business[0]!, ESCALATION_OPTIONS.business[1]!], other: "a refund over $200" };
    const rule = composeEscalation(picked);
    expect(rule).toBe("Stop and ask a person when: the customer is angry or upset; money is involved - refunds, discounts or payments; a refund over $200.");
    expect(parseEscalation(rule, "business")).toEqual(picked);
  });

  it("never ends a rule with two full stops", () => {
    expect(composeEscalation({ selected: [], other: "Escalate if pricing comes up." })).toBe("Stop and ask a person when: Escalate if pricing comes up.");
  });

  it("keeps a rule written in the owner's own words, word for word", () => {
    const rule = "Escalate if the client mentions legal action.";
    expect(parseEscalation(rule, "business")).toEqual({ selected: [], other: rule });
  });

  it("reads who is involved back into chips plus the owner's own words", () => {
    const text = composeChoices({ selected: ["Just me", "My partner"], other: "Sam pays half the rent" });
    expect(parseChoices(text, STAKEHOLDER_OPTIONS.personal)).toEqual({ selected: ["Just me", "My partner"], other: "Sam pays half the rent" });
  });

  it("gives every agent a voice without anyone writing one", () => {
    expect(defaultPersonality("business").length).toBeGreaterThan(20);
    expect(defaultPersonality("personal").length).toBeGreaterThan(20);
  });

  it("stops asking 'never', but keeps an answer someone already wrote", () => {
    expect(shownAgentQuestions("personal", {}).map((q) => q.id)).not.toContain("never");
    expect(shownAgentQuestions("personal", { never: "Never suggest a loan" }).map((q) => q.id)).toContain("never");
  });
});
