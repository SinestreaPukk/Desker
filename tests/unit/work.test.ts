import { describe, expect, it } from "vitest";
import { ACTION_STATUSES, TRANSITIONS, canTransition, effectiveAutonomy } from "@/lib/work/types";
import { cadenceToCron, cronToCadence, describeCadence } from "@/lib/work/cadence";
import { WORK_TOOL_IDS, WORK_TOOL_RISK, workToolDefinitions } from "@/lib/work/tools";
import { htmlToText } from "@/lib/work/research";
import { isPublicAddress, isPublicIPv4 } from "@/lib/platform/public-host";

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
    // A rejection can be undone from the toast, and only back to the queue
    // it came from - never straight to approved.
    expect(TRANSITIONS.rejected).toEqual(["needs_approval"]);
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("an owner can cancel work only before it reaches the outside world", () => {
    expect(canTransition("queued", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
    expect(canTransition("approved", "cancelled")).toBe(false);
    expect(canTransition("executing_external", "cancelled")).toBe(false);
    expect(TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("trust settings", () => {
  it("legacy autonomy settings never bypass approval", () => {
    expect(effectiveAutonomy("draft_only", null, "publish_post")).toBe("draft_only");
    expect(effectiveAutonomy("draft_only", { publish_post: "auto" }, "publish_post")).toBe("draft_only");
    expect(effectiveAutonomy("draft_only", { publish_post: "auto" }, "send_email")).toBe("draft_only");
    expect(effectiveAutonomy("auto", { send_email: "draft_only" }, "send_email")).toBe("draft_only");
    expect(effectiveAutonomy("auto", null, "send_email")).toBe("draft_only");
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
    const definitions = workToolDefinitions(WORK_TOOL_IDS);
    for (const [index, id] of WORK_TOOL_IDS.entries()) {
      expect(definitions[index]!.name).toBe(id);
      expect(WORK_TOOL_RISK[id]).toBeDefined();
    }
    expect(WORK_TOOL_RISK.escalate_to_human).toBe("internal");
    expect(WORK_TOOL_RISK.publish_post).toBe("external");
    expect(WORK_TOOL_RISK.send_email).toBe("external");
    expect(WORK_TOOL_RISK.draft_content).toBe("draft");
    expect(WORK_TOOL_RISK.web_research).toBe("read");
    expect(WORK_TOOL_RISK.delegate_to_colleague).toBe("internal");
    expect(WORK_TOOL_RISK.suggest_opportunity).toBe("draft");
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

describe("public address filter", () => {
  it("rejects private, loopback, link-local, and reserved IPv4 ranges", () => {
    for (const address of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.1", "224.0.0.1"]) {
      expect(isPublicIPv4(address)).toBe(false);
    }
    expect(isPublicIPv4("8.8.8.8")).toBe(true);
  });

  it("allows global IPv6 while rejecting local and transition addresses", () => {
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    for (const address of ["::1", "fc00::1", "fe80::1", "2001:db8::1", "2002::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });
});
