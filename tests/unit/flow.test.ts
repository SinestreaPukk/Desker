/**
 * The flow view is a reading of the scope of work, so what it shows is a pure
 * function of the record. These pin the shape: which nodes exist, in what
 * order, and when the approval gate appears at all.
 */
import { describe, expect, it } from "vitest";
import { approvalDetail, buildScopeFlow, type ScopeFlowInput } from "@/lib/work/flow";
import { WORK_TOOL_IDS } from "@/lib/work/tools";

function input(overrides: Partial<ScopeFlowInput> = {}): ScopeFlowInput {
  return {
    agentName: "Sam",
    jobTitle: "Content Marketer",
    triggerType: "manual",
    cron: null,
    timezone: "UTC",
    enabled: true,
    tools: ["web_research", "draft_content"],
    autonomy: "draft_only",
    toolAutonomy: null,
    objectiveCount: 2,
    contextAnswered: 3,
    digestCadence: "weekly",
    ...overrides,
  };
}

describe("the shape of the flow", () => {
  it("reads trigger, agent, tools, then where it lands", () => {
    const nodes = buildScopeFlow(input());
    expect(nodes.map((node) => node.kind)).toEqual(["trigger", "agent", "tool", "tool", "output"]);
    expect(nodes[0]!.title).toBe("Only when you run it");
    expect(nodes[1]!.title).toBe("Sam");
    expect(nodes[1]!.detail).toBe("Reads 3 context answers, then works through 2 objectives.");
  });

  it("keeps the tool registry's order however the tools were ticked", () => {
    const nodes = buildScopeFlow(input({ tools: ["send_email", "search_documents", "web_research"] }));
    const tools = nodes.filter((node) => node.kind === "tool").map((node) => node.tool);
    expect(tools).toEqual(
      WORK_TOOL_IDS.filter((id) => ["send_email", "search_documents", "web_research"].includes(id)),
    );
  });

  it("says so when there are no tools rather than drawing an empty pipeline", () => {
    const nodes = buildScopeFlow(input({ tools: [] }));
    const empty = nodes.find((node) => node.id === "tools-empty");
    expect(empty?.tone).toBe("warning");
    expect(empty?.section).toBe("tools");
    expect(nodes.some((node) => node.kind === "approval")).toBe(false);
  });

  it("gives every node a control to open", () => {
    const nodes = buildScopeFlow(input({ tools: [...WORK_TOOL_IDS] }));
    for (const node of nodes) expect(node.section).toBeTruthy();
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  });
});

describe("the approval gate", () => {
  it("appears only when a tool can reach the outside world", () => {
    expect(buildScopeFlow(input({ tools: ["web_research"] })).some((n) => n.kind === "approval")).toBe(
      false,
    );
    expect(
      buildScopeFlow(input({ tools: ["web_research", "publish_post"] })).some(
        (n) => n.kind === "approval",
      ),
    ).toBe(true);
  });

  it("sits between the tools and the output, never before them", () => {
    const nodes = buildScopeFlow(input({ tools: ["draft_content", "publish_post", "send_email"] }));
    const kinds = nodes.map((node) => node.kind);
    expect(kinds.indexOf("approval")).toBeGreaterThan(kinds.lastIndexOf("tool"));
    expect(kinds.indexOf("approval")).toBeLessThan(kinds.indexOf("output"));
  });

  it("says which of them actually wait", () => {
    const both = input({ tools: ["publish_post", "send_email"] });
    expect(approvalDetail(both)).toContain("Posts and Emails wait here");

    const auto = input({ tools: ["publish_post", "send_email"], autonomy: "auto" });
    expect(approvalDetail(auto)).toContain("go straight out");

    const mixed = input({
      tools: ["publish_post", "send_email"],
      autonomy: "auto",
      toolAutonomy: { send_email: "draft_only" },
    });
    expect(approvalDetail(mixed)).toContain("Emails wait for you");
    expect(approvalDetail(mixed)).toContain("posts go straight out");
  });
});

describe("the trigger node", () => {
  it("describes a cadence in words", () => {
    const [trigger] = buildScopeFlow(
      input({ triggerType: "cron", cron: "0 9 * * 1", timezone: "Europe/London" }),
    );
    expect(trigger!.title).toBe("On a schedule");
    expect(trigger!.detail).toContain("Every Monday at 09:00");
  });

  it("shows a paused trigger as paused rather than as running", () => {
    const [trigger] = buildScopeFlow(input({ triggerType: "cron", cron: "0 9 * * 1", enabled: false }));
    expect(trigger!.dimmed).toBe(true);
    expect(trigger!.detail.startsWith("Paused")).toBe(true);
  });

  it("names the webhook without leaking its URL", () => {
    const [trigger] = buildScopeFlow(input({ triggerType: "webhook" }));
    expect(trigger!.title).toBe("When an event arrives");
    expect(trigger!.detail).not.toContain("http");
  });
});

describe("the output node", () => {
  it("promises nothing leaves the building when nothing can", () => {
    const nodes = buildScopeFlow(input({ tools: ["web_research"], digestCadence: "off" }));
    const output = nodes.at(-1)!;
    expect(output.kind).toBe("output");
    expect(output.detail).toContain("Nothing leaves the building");
    expect(output.detail).not.toContain("digest");
  });

  it("mentions the digest when the agent reports back", () => {
    const nodes = buildScopeFlow(input({ digestCadence: "daily" }));
    expect(nodes.at(-1)!.detail).toContain("digest every morning");
  });
});
