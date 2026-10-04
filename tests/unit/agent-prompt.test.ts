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
    const prompt = buildSystemPrompt({ ...base, aboutPerson: "About me: Maya, a designer in Bangkok." });
    expect(prompt).toContain("## About the person you work for");
    expect(prompt).toContain("Maya, a designer in Bangkok");
    expect(prompt).not.toContain("Company context");
  });
});

import { buildPrompt } from "@/lib/agents/agent-prompt";

describe("buildPrompt (cache-friendly split)", () => {
  const now = new Date("2026-10-04T03:00:00Z");

  it("keeps the date, live figures and channel out of the stable part", () => {
    const a = buildPrompt({ ...base, now, timezone: "Asia/Bangkok", channel: "messaging", volatile: ["## Life\nSpent 10"] });
    const b = buildPrompt({ ...base, now: new Date("2026-10-05T09:00:00Z"), timezone: "Asia/Bangkok", channel: "app", volatile: ["## Life\nSpent 20"] });
    expect(a.stable).toBe(b.stable);
    expect(a.volatile).toContain("Spent 10");
    expect(a.volatile).toContain("plain text");
    expect(b.volatile).not.toBe(a.volatile);
    expect(a.stable).not.toMatch(/2026/);
  });

  it("lets a caller replace the generic abilities text so the two never contradict", () => {
    const prompt = buildPrompt({ ...base, allowedTools: [], abilities: "## What you can do\nStart tasks that use a browser." }).stable;
    expect(prompt).toContain("Start tasks that use a browser.");
    expect(prompt).not.toContain("You have no tools in this conversation");
  });

  it("states the priority order and uses no company wording", () => {
    const { stable } = buildPrompt(base);
    expect(stable).toContain("follow this order: the safety rules");
    expect(stable.toLowerCase()).not.toContain("company");
  });

  it("buildSystemPrompt is the two parts joined", () => {
    const parts = buildPrompt({ ...base, now });
    expect(buildSystemPrompt({ ...base, now })).toBe(`${parts.stable}\n\n${parts.volatile}`);
  });
});
