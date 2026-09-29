import { describe, expect, it } from "vitest";
import { spaceKind, spacesFor } from "@/lib/space";
import { contextQuestionsFor, effectiveContext, hasCoreContext } from "@/lib/work/context";
import { missingGrounding } from "@/lib/work/preflight";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { templatesFor } from "@/lib/content";

describe("business and personal spaces", () => {
  it("founds one space per kind asked for, business first", () => {
    expect(spacesFor("business")).toEqual(["business"]);
    expect(spacesFor("personal")).toEqual(["personal"]);
    expect(spacesFor("mixed")).toEqual(["business", "personal"]);
    expect(spaceKind("anything else")).toBe("business");
  });

  it("asks a person about themselves, and keeps the agent question ids stable", () => {
    const personal = contextQuestionsFor("personal");
    const business = contextQuestionsFor("business");
    expect(personal.core.map((q) => q.id)).toEqual(["about", "goals", "tone", "never"]);
    expect(personal.agent.map((q) => [q.id, q.promptLabel])).toEqual(business.agent.map((q) => [q.id, q.promptLabel]));
    const answers = { about: "Maya, designer.", goals: "Save money.", tone: "Short.", never: "Never post." };
    expect(hasCoreContext({ context: "", contextAnswers: answers }, "personal")).toBe(true);
    expect(hasCoreContext({ context: "", contextAnswers: answers }, "business")).toBe(false);
    expect(effectiveContext({ projectContext: "About me: Maya", agentContext: "Budget.", kind: "personal" })).toContain(
      "About the person you work for",
    );
  });

  it("grounds a personal run in the person, not a company", () => {
    const base = { agentAnswers: {}, objectives: ["x"], tools: ["draft_content"], documentCount: 1, trigger: "manual" };
    expect(missingGrounding({ ...base, projectAnswers: { about: "Maya", tone: "Short" }, kind: "personal" })).toEqual([]);
    expect(missingGrounding({ ...base, projectAnswers: {}, kind: "personal" })).toEqual([
      "Who you are (About you)",
      "How your assistants should talk (About you)",
    ]);
  });

  it("frames a personal assistant as working privately for one person", () => {
    const prompt = buildSystemPrompt({
      name: "Penny",
      jobTitle: "Money Manager",
      personality: "Calm and precise.",
      responsibilities: [],
      allowedTools: [],
      companyContext: "About me: Maya",
      audience: "colleague",
      kind: "personal",
    });
    expect(prompt).toContain("working privately for one person");
    expect(prompt).toContain("## About the person you work for");
    expect(prompt).toContain("never move money");
    expect(prompt).not.toContain("Company context");
  });

  it("offers each kind of space its own roles", () => {
    expect(templatesFor("personal").map((t) => t.id)).toContain("money-manager");
    expect(templatesFor("business").some((t) => t.audience === "personal")).toBe(false);
    expect(templatesFor("personal").every((t) => !t.allowedTools.includes("log_issue"))).toBe(true);
  });
});
