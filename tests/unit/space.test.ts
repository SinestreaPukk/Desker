import { describe, expect, it } from "vitest";
import { contextQuestions, effectiveContext, hasCoreContext } from "@/lib/work/context";
import { missingGrounding } from "@/lib/work/preflight";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { TEMPLATES } from "@/lib/content";

describe("a personal space", () => {
  it("asks a person about themselves", () => {
    const questions = contextQuestions();
    expect(questions.core.map((q) => q.id)).toEqual(["about", "goals", "tone", "never"]);
    const answers = { about: "Maya, designer.", goals: "Save money.", tone: "Short.", never: "Never post." };
    expect(hasCoreContext({ context: "", contextAnswers: answers })).toBe(true);
    expect(hasCoreContext({ context: "", contextAnswers: {} })).toBe(false);
    expect(effectiveContext({ projectContext: "About me: Maya", agentContext: "Budget." })).toContain("About the person you work for");
  });

  it("grounds a run in the person", () => {
    const base = { agentAnswers: {}, objectives: ["x"], tools: ["draft_content"], documentCount: 1, trigger: "manual" };
    expect(missingGrounding({ ...base, projectAnswers: { about: "Maya", tone: "Short" } })).toEqual([]);
    expect(missingGrounding({ ...base, projectAnswers: {} })).toEqual([
      "Who you are (About you)",
      "How your assistants should talk (About you)",
    ]);
  });

  it("frames an assistant as working privately for one person", () => {
    const prompt = buildSystemPrompt({
      name: "Penny",
      jobTitle: "Money Manager",
      personality: "Calm and precise.",
      responsibilities: [],
      allowedTools: [],
      companyContext: "About me: Maya",
    });
    expect(prompt).toContain("working privately for one person");
    expect(prompt).toContain("## About the person you work for");
    expect(prompt).toContain("never move money");
  });

  it("offers one personal assistant, with no client-chat tools", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["personal-assistant"]);
    expect(TEMPLATES.every((t) => t.allowedTools.every((tool) => tool === "search_documents"))).toBe(true);
  });
});
