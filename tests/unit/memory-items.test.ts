import { describe, expect, it } from "vitest";
import { changeLine, memoryItems } from "@/lib/agents/memory-items";

describe("memory items", () => {
  const answers = { goals: "- Save for a flat\n- Run a 10k", tone: "Plain, direct.", about: "Not memory" };

  it("lists one fact per line, in field order, skipping About you", () => {
    expect(memoryItems(answers).map((item) => `${item.fieldId}:${item.text}`)).toEqual(["goals:Save for a flat", "goals:Run a 10k", "tone:Plain, direct."]);
  });

  it("forgets or edits a single line and leaves the rest", () => {
    expect(changeLine(answers.goals, 0, null)).toBe("Run a 10k");
    expect(changeLine(answers.goals, 1, "Run a half marathon")).toBe("Save for a flat\nRun a half marathon");
    expect(changeLine("Only one", 0, null)).toBe("");
  });
});
