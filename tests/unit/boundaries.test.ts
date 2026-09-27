import { describe, expect, it } from "vitest";
import { describeBoundaries } from "@/lib/work/boundaries";

describe("describeBoundaries", () => {
  it("says what needs approval, what goes out on its own, and what is not its job", () => {
    const { can, cannot } = describeBoundaries({
      tools: ["web_research", "draft_content", "send_email", "slack_post_message"],
      autonomy: "draft_only",
      toolAutonomy: { slack_post_message: "auto" },
    });
    expect(can).toEqual(["Research the web and cite its sources", "Write drafts for you to review", "Post to Slack without asking you"]);
    expect(cannot).toContain("Send emails without your approval");
    expect(cannot).toContain("Publish posts");
    expect(cannot).toContain("Spend money, sign or agree to anything");
  });

  it("reads a null tool list as every tool", () => {
    const { can } = describeBoundaries({ tools: null, autonomy: "auto", toolAutonomy: null });
    expect(can).toContain("Send emails without asking you");
    expect(can).toContain("Look things up in the documents you gave it");
  });
});
