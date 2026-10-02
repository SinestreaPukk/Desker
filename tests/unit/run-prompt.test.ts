import { describe, expect, it } from "vitest";
import { buildRunPrompt } from "@/lib/work/prompt";

const base = {
  agent: { name: "Nova", jobTitle: "Content Marketer", department: null, personality: "Plain.", escalationRule: null },
  scope: { context: "", objectives: [] },
  autonomy: "draft_only" as const,
  documentNames: [],
  hasEmail: false,
};

describe("what a run is told about publishing", () => {
  it("offers publish_post for a directly connected network even with no webhook", () => {
    const prompt = buildRunPrompt({ ...base, hasPublishing: false, socialNetworks: ["LinkedIn"] });
    expect(prompt).toContain("LinkedIn is connected directly");
    expect(prompt).not.toContain("do not call publish_post");
  });

  it("still says nothing can be published when nothing is connected", () => {
    const prompt = buildRunPrompt({ ...base, hasPublishing: false, socialNetworks: [] });
    expect(prompt).toContain("do not call publish_post");
  });
});
