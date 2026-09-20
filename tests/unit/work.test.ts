import { describe, expect, it } from "vitest";
import { ACTION_STATUSES, TRANSITIONS, canTransition } from "@/lib/work/types";
import { cadenceToCron, cronToCadence, describeCadence } from "@/lib/work/cadence";
import { WORK_TOOL_IDS, WORK_TOOL_RISK, WORK_TOOLS } from "@/lib/work/tools";
import { htmlToText } from "@/lib/work/research";

describe("action item state machine", () => {
  it("follows the documented path and nothing else", () => {
    expect(canTransition("queued", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "needs_approval")).toBe(true);
    expect(canTransition("needs_approval", "approved")).toBe(true);
    expect(canTransition("approved", "executing_external")).toBe(true);
    expect(canTransition("executing_external", "done")).toBe(true);
    expect(canTransition("needs_approval", "rejected")).toBe(true);

    expect(canTransition("queued", "done")).toBe(false);
    expect(canTransition("done", "approved")).toBe(false);
    expect(canTransition("needs_approval", "done")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("nonsense", "done")).toBe(false);
  });

  it("terminal states have no exits and every state is covered", () => {
    for (const status of ACTION_STATUSES) expect(TRANSITIONS[status]).toBeDefined();
    expect(TRANSITIONS.done).toEqual([]);
    expect(TRANSITIONS.failed).toEqual([]);
    expect(TRANSITIONS.rejected).toEqual([]);
  });
});

describe("cadence <-> cron", () => {
  it("round-trips every preset", () => {
    const cases = [
      { kind: "hourly" as const },
      { kind: "daily" as const, hour: 9, minute: 30 },
      { kind: "weekdays" as const, hour: 17, minute: 0 },
      { kind: "weekly" as const, weekday: 1, hour: 9, minute: 0 },
    ];
    for (const cadence of cases) {
      expect(cronToCadence(cadenceToCron(cadence))).toEqual(cadence);
    }
  });

  it("keeps anything it cannot name as custom", () => {
    expect(cronToCadence("*/15 * * * *")).toEqual({ kind: "custom", cron: "*/15 * * * *" });
    expect(cronToCadence("0 9 1 * *")).toEqual({ kind: "custom", cron: "0 9 1 * *" });
  });

  it("describes a schedule for a person", () => {
    expect(describeCadence("0 9 * * 1", "Europe/London")).toBe("Every Monday at 09:00 (Europe/London)");
    expect(describeCadence("30 17 * * 1-5", "UTC")).toBe("Weekdays at 17:30 (UTC)");
    expect(describeCadence("0 * * * *")).toBe("Every hour, on the hour");
  });
});

describe("work tools", () => {
  it("every tool has a definition and a declared risk level", () => {
    for (const id of WORK_TOOL_IDS) {
      expect(WORK_TOOLS[id].name).toBe(id);
      expect(WORK_TOOL_RISK[id]).toBeDefined();
    }
    expect(WORK_TOOL_RISK.publish_post).toBe("external");
    expect(WORK_TOOL_RISK.send_email).toBe("external");
    expect(WORK_TOOL_RISK.draft_content).toBe("draft");
    expect(WORK_TOOL_RISK.web_research).toBe("read");
  });
});

describe("htmlToText", () => {
  it("drops scripts and tags and keeps the words", () => {
    const text = htmlToText(
      "<html><head><style>p{}</style><script>alert(1)</script></head><body><h1>Hi&amp;bye</h1><p>One</p><p>Two</p></body></html>",
    );
    expect(text).toBe("Hi&bye\nOne\nTwo");
  });
});
