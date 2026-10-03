import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/agents/agent-prompt";

const base = {
  name: "Penny",
  jobTitle: "Money Manager",
  personality: "Calm and precise. Never uses filler.",
  responsibilities: ["Add up my spending", "Flag subscriptions I forgot"],
  allowedTools: ["search_documents"],
};

describe("buildSystemPrompt", () => {
  it("names the agent and frames it as working privately for one person", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("You are Penny, Money Manager");
    expect(prompt).toContain("working privately for one person");
  });

  it("includes the personality verbatim", () => {
    expect(buildSystemPrompt(base)).toContain(base.personality);
  });

  it("lists every responsibility", () => {
    const prompt = buildSystemPrompt(base);
    for (const item of base.responsibilities) expect(prompt).toContain(item);
  });

  it("always states the non-negotiable rules", () => {
    const prompt = buildSystemPrompt({ ...base, allowedTools: [] });
    expect(prompt).toMatch(/never claim or imply that you are a human/i);
    expect(prompt).toMatch(/do not invent facts/i);
    expect(prompt).toContain("never move money");
  });

  it("only describes tools the agent is actually given", () => {
    expect(buildSystemPrompt(base)).toContain("search_documents");
    const none = buildSystemPrompt({ ...base, allowedTools: [] });
    expect(none).not.toContain("search_documents");
    expect(none).not.toContain("## Your tools");
  });

  it("ignores unknown tool ids rather than leaking them into the prompt", () => {
    expect(buildSystemPrompt({ ...base, allowedTools: ["definitely_not_a_tool"] })).not.toContain("definitely_not_a_tool");
  });

  it("lists searchable documents only when search is permitted", () => {
    expect(buildSystemPrompt({ ...base, documentNames: ["lease.pdf"] })).toContain("lease.pdf");
    expect(buildSystemPrompt({ ...base, allowedTools: [], documentNames: ["lease.pdf"] })).not.toContain("lease.pdf");
  });

  it("includes what the person told it, marked private", () => {
    const prompt = buildSystemPrompt({ ...base, companyContext: "About me: Maya, a designer in Bangkok." });
    expect(prompt).toContain("## About the person you work for");
    expect(prompt).toContain("Maya, a designer in Bangkok");
    expect(prompt).not.toContain("Company context");
  });
});
