import { describe, expect, it } from "vitest";
import { missingGrounding, type PreflightInput } from "@/lib/work/preflight";

const grounded: PreflightInput = {
  projectAnswers: { about: "a", goals: "g", tone: "t", never: "n" },
  agentAnswers: { project: "Q4 warranty push", stakeholders: "Priya" },
  objectives: ["x"],
  tools: ["draft_content", "send_email"],
  documentCount: 0,
  trigger: "schedule",
};

describe("missingGrounding", () => {
  it("passes a grounded writer", () => {
    expect(missingGrounding(grounded)).toEqual([]);
  });

  it("lists everything a blind writer is missing", () => {
    const missing = missingGrounding({
      ...grounded,
      projectAnswers: {},
      agentAnswers: {},
      objectives: [],
      tools: ["web_research", "draft_content", "publish_post"],
    });
    expect(missing).toHaveLength(4);
    expect(missing.some((m) => m.startsWith("What to write about"))).toBe(true);
  });

  it("accepts an uploaded document in place of the brief", () => {
    const missing = missingGrounding({ ...grounded, agentAnswers: {}, documentCount: 1 });
    expect(missing).toEqual([]);
  });

  it("holds an agent with every tool to the company-wide checks only", () => {
    expect(missingGrounding({ ...grounded, agentAnswers: {}, tools: null })).toEqual([]);
    expect(missingGrounding({ ...grounded, projectAnswers: { about: "a" }, tools: null })).toHaveLength(1);
  });

  it("only needs who you are for a non-writing role", () => {
    expect(
      missingGrounding({
        ...grounded,
        projectAnswers: { about: "a" },
        agentAnswers: {},
        tools: ["web_research"],
        trigger: "manual",
      }),
    ).toEqual([]);
  });

  it("needs objectives only on a scheduled run", () => {
    const base = { ...grounded, objectives: [], tools: [] };
    expect(missingGrounding({ ...base, trigger: "manual" })).toEqual([]);
    expect(missingGrounding({ ...base, trigger: "webhook" })).toEqual([]);
    expect(missingGrounding({ ...base, trigger: "schedule" })).toEqual(["Standing objectives (Scope of work)"]);
  });
});
