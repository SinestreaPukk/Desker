import { describe, expect, it } from "vitest";
import { describeBoundaries } from "@/lib/work/boundaries";

describe("describeBoundaries", () => {
  it("lists only this agent's tools and keeps external effects behind approval", () => {
    const { can, cannot } = describeBoundaries({
      tools: ["web_research", "draft_content", "send_email", "slack_post_message"],
      autonomy: "draft_only",
      toolAutonomy: { slack_post_message: "auto" },
    });
    expect(can).toEqual([
      "Research the web and cite its sources",
      "Write drafts for you to review",
    ]);
    expect(cannot).toEqual([
      "Send emails without your approval",
      "Post to Slack without your approval",
      "Spend money, sign or agree to anything",
    ]);
  });

  it("reads a null tool list as every tool", () => {
    const { can } = describeBoundaries({ tools: null, autonomy: "auto", toolAutonomy: null });
    expect(can).not.toContain("Send emails without asking you");
    expect(can).toContain("Look things up in the documents you gave it");
  });
});
