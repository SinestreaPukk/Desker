/**
 * Guided context: what the questions compose into, and what happens to text
 * that was written before the questions existed.
 */
import { describe, expect, it } from "vitest";
import {
  AGENT_CONTEXT_QUESTIONS,
  PROJECT_CONTEXT_QUESTIONS,
  answeredCount,
  answersFor,
  composeContext,
  effectiveContext,
  toContextAnswers,
} from "@/lib/work/context";

describe("the question sets", () => {
  it("are short, and every question carries an example rather than prefilled text", () => {
    for (const questions of [AGENT_CONTEXT_QUESTIONS, PROJECT_CONTEXT_QUESTIONS]) {
      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(5);
      const ids = new Set(questions.map((question) => question.id));
      expect(ids.size).toBe(questions.length);
      for (const question of questions) {
        expect(question.label.length).toBeGreaterThan(5);
        expect(question.placeholder.length).toBeGreaterThan(20);
        expect(question.hint).toBeTruthy();
        expect(question.promptLabel).toBeTruthy();
      }
    }
  });
});

describe("composing the answers", () => {
  it("labels each answer and leaves unanswered questions out entirely", () => {
    const composed = composeContext(
      { project: "We are pushing the lifetime warranty.", never: "Never quote a price." },
      AGENT_CONTEXT_QUESTIONS,
    );
    expect(composed).toContain("About this work: We are pushing the lifetime warranty.");
    expect(composed).toContain("Never: Never quote a price.");
    // Nothing for the two that were not answered - no empty headings.
    expect(composed.split("\n\n")).toHaveLength(2);
    expect(composed).not.toContain("Working for");
  });

  it("is empty when nothing is answered", () => {
    expect(composeContext({}, AGENT_CONTEXT_QUESTIONS)).toBe("");
    expect(composeContext({ project: "   " }, AGENT_CONTEXT_QUESTIONS)).toBe("");
  });

  it("keeps the order of the questions, not the order they were answered", () => {
    const composed = composeContext(
      { never: "No prices.", project: "Warranty push." },
      AGENT_CONTEXT_QUESTIONS,
    );
    expect(composed.indexOf("About this work")).toBeLessThan(composed.indexOf("Never"));
  });
});

describe("reading a Json column back", () => {
  it("keeps known ids, trims them, and drops everything else", () => {
    const answers = toContextAnswers(
      { project: "  a  ", nonsense: "b", success: 42, never: "" },
      AGENT_CONTEXT_QUESTIONS,
    );
    expect(answers).toEqual({ project: "a" });
  });

  it("survives null, arrays and strings in the column", () => {
    expect(toContextAnswers(null, AGENT_CONTEXT_QUESTIONS)).toEqual({});
    expect(toContextAnswers(["a"], AGENT_CONTEXT_QUESTIONS)).toEqual({});
    expect(toContextAnswers("a", AGENT_CONTEXT_QUESTIONS)).toEqual({});
  });
});

describe("context written before the questions existed", () => {
  it("opens as the answer to the first question rather than being lost", () => {
    const legacy = "We sell hand tools to tradespeople. Plain tone, no hype.";
    expect(answersFor(null, legacy, AGENT_CONTEXT_QUESTIONS)).toEqual({
      [AGENT_CONTEXT_QUESTIONS[0]!.id]: legacy,
    });
  });

  it("is ignored once there are real answers", () => {
    expect(answersFor({ success: "Two good drafts." }, "old text", AGENT_CONTEXT_QUESTIONS)).toEqual({
      success: "Two good drafts.",
    });
  });

  it("stays empty when there was nothing there", () => {
    expect(answersFor(null, "", AGENT_CONTEXT_QUESTIONS)).toEqual({});
    expect(answersFor(null, null, AGENT_CONTEXT_QUESTIONS)).toEqual({});
  });
});

describe("what a run actually reads", () => {
  it("puts the project's shared context first, labelled apart from the agent's", () => {
    const text = effectiveContext({
      projectContext: "About me: I work in design.",
      agentContext: "About this work: warranty push.",
    });
    expect(text.indexOf("I work in design")).toBeLessThan(text.indexOf("warranty push"));
    expect(text).toContain("shared by all of their assistants");
    expect(text).toContain("Specific to you");
  });

  it("adds no scaffolding when only one of the two exists", () => {
    expect(effectiveContext({ projectContext: "", agentContext: "Mine." })).toBe("Mine.");
    expect(effectiveContext({ projectContext: "Shared.", agentContext: "  " })).toBe("Shared.");
    expect(effectiveContext({ projectContext: null, agentContext: undefined })).toBe("");
  });
});

describe("counting answers", () => {
  it("counts only questions with something in them", () => {
    expect(answeredCount({}, AGENT_CONTEXT_QUESTIONS)).toBe(0);
    expect(
      answeredCount({ project: "a", never: " ", unknown: "b" }, AGENT_CONTEXT_QUESTIONS),
    ).toBe(1);
  });
});
