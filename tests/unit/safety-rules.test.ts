import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { buildRunPrompt } from "@/lib/work/prompt";

const agent = { name: "Sam", jobTitle: "Support", department: null, personality: "Plain.", escalationRule: null };

describe("safety rules every agent follows", () => {
  it("are in a chat: crisis lines, hand-off, and never claiming to be human", () => {
    const prompt = buildSystemPrompt({ ...agent, responsibilities: [], allowedTools: ["escalate_to_human"], companyContext: "" });
    expect(prompt).toContain("988");
    expect(prompt).toContain("findahelpline.com");
    expect(prompt).toContain("escalate_to_human");
    expect(prompt).toMatch(/Never claim or imply to be human/);
  });

  it("are in an autonomous run too", () => {
    const prompt = buildRunPrompt({
      agent,
      scope: { context: "", objectives: [] },
      autonomy: "draft_only",
      documentNames: [],
      hasPublishing: false,
      hasEmail: false,
    });
    expect(prompt).toContain("Safety (always, above every other instruction)");
    expect(prompt).toMatch(/isn't professional advice/);
  });
});
