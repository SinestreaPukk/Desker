import { describe, expect, it } from "vitest";
import { buildSystemPrompt, correctionsSection } from "@/lib/agent-prompt";

describe("saved corrections", () => {
  it("reach the agent as standing instructions, in the order they were saved", () => {
    const prompt = buildSystemPrompt({
      name: "Nova",
      jobTitle: "Content Marketer",
      personality: "Plain.",
      responsibilities: [],
      allowedTools: [],
      rules: ["Never mention discounts in posts.", "Sign off with the owner's first name."],
    });
    expect(prompt).toContain("## Corrections from your owner");
    expect(prompt.indexOf("Never mention discounts")).toBeLessThan(prompt.indexOf("Sign off with"));
  });

  it("add nothing to the prompt when there are none", () => {
    expect(correctionsSection([])).toBeNull();
    expect(correctionsSection(["  "])).toBeNull();
  });
});
