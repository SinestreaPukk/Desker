/**
 * The promise this phase makes: nothing an owner reads requires knowing what
 * a token is, what a status code means, or what the engineering team called
 * something internally. These pin the two layers that do the translating.
 */
import { describe, expect, it } from "vitest";
import { actorWords, dayHeading, describeAuditEntry, timeOfDay } from "@/lib/audit-copy";
import { WORK_TOOL_IDS } from "@/lib/work/tools";

/** The words that mean the translation did not happen. */
const JARGON = [
  "token",
  "api",
  "status code",
  "http",
  "null",
  "undefined",
  "publish_post",
  "send_email",
  "web_research",
  "search_context",
  "search_documents",
  "draft_content",
  "action_item",
  "tool.called",
];

function expectPlain(text: string) {
  const lower = text.toLowerCase();
  for (const word of JARGON) {
    expect(lower, `"${text}" still says "${word}"`).not.toContain(word);
  }
}

describe("the audit log, in sentences", () => {
  it("says what a research call did, not which tool ran", () => {
    const described = describeAuditEntry({
      action: "tool.called",
      actorType: "agent",
      actorName: "Sam",
      metadata: { tool: "web_research", ok: true, input: { query: "competitor pricing" } },
    });
    expect(described.title).toBe("Researched competitor pricing");
    expectPlain(described.title);
  });

  it("says what is waiting on the owner when a tool was gated", () => {
    const described = describeAuditEntry({
      action: "tool.called",
      actorType: "agent",
      metadata: { tool: "publish_post", ok: true, gated: true },
    });
    expect(described.title).toBe("Queued a post for your approval");
    expect(described.detail).toContain("Nothing has been published");
    expect(described.tone).toBe("warning");
  });

  it("says a failure failed, and what it said", () => {
    const described = describeAuditEntry({
      action: "tool.called",
      actorType: "agent",
      metadata: { tool: "send_email", ok: false, result: "the provider refused the address" },
    });
    expect(described.title).toBe("Tried to send an email");
    expect(described.detail).toContain("the provider refused the address");
    expect(described.tone).toBe("danger");
  });

  it("names the person who decided something", () => {
    const described = describeAuditEntry({
      action: "action_item.approved",
      actorType: "user",
      actorName: "Priya",
    });
    expect(described.title).toBe("Priya approved what an agent wanted to send");
  });

  it("never leaves a raw dotted verb on screen", () => {
    const described = describeAuditEntry({ action: "something.entirely.new", actorType: "system" });
    expect(described.title).toBe("Something entirely new");
    expectPlain(described.title);
  });

  it("covers every action the product writes", () => {
    const actions = [
      "tool.called",
      "action_item.created",
      "action_item.done",
      "action_item.failed",
      "action_item.needs_approval",
      "action_item.approved",
      "action_item.rejected",
      "action_item.reopened",
      "action_item.retried",
      "action_item.refused",
      "publish_post.delivered",
      "publish_post.failed",
      "send_email.delivered",
      "send_email.failed",
      "digest.created",
      "suggestion.created",
      "suggestion.accepted",
      "suggestion.dismissed",
      "suggestion.snoozed",
      "draft.edited",
      "scope_of_work.updated",
      "workflow.started",
      "agent_rule.created",
      "agent_rule.updated",
      "agent_rule.removed",
      "project.context_updated",
      "integration.connected",
      "integration.removed",
      "organization.created",
      "organization.renamed",
      "project.created",
      "project.updated",
      "project.deleted",
      "membership.role_changed",
      "invitation.created",
      "invitation.accepted",
      "invitation.revoked",
      "billing.checkout_started",
      "billing.subscription_updated",
      "conversation.refused",
    ];
    for (const action of actions) {
      const described = describeAuditEntry({ action, actorType: "agent", actorName: "Sam" });
      expect(described.title.length, action).toBeGreaterThan(4);
      expectPlain(described.title);
      if (described.detail) expectPlain(described.detail);
    }
  });

  it("says who did it without an id", () => {
    expect(actorWords({ action: "x", actorType: "agent", actorName: "Sam" })).toBe("Sam (agent)");
    expect(actorWords({ action: "x", actorType: "schedule" })).toBe("A schedule");
    expect(actorWords({ action: "x", actorType: "system" })).toBe("Desker");
    expect(actorWords({ action: "x", actorType: "user" })).toBe("A person");
  });
});

describe("timestamps a person reads", () => {
  it("shows a time of day, not an ISO string", () => {
    expect(timeOfDay("2026-09-23T09:03:00Z", "en-GB")).toMatch(/^\d{1,2}:\d{2}$/);
    expect(timeOfDay("2026-09-23T09:03:00Z", "en-US")).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("groups by today, yesterday, then the date", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(dayHeading("2026-09-23T09:00:00Z", now, "en-GB")).toBe("Today");
    expect(dayHeading("2026-09-22T09:00:00Z", now, "en-GB")).toBe("Yesterday");
    expect(dayHeading("2026-09-18T09:00:00Z", now, "en-GB")).toBe("18 September");
    expect(dayHeading("2025-09-18T09:00:00Z", now, "en-GB")).toBe("18 September 2025");
  });
});

describe("every work tool, in the audit log", () => {
  it("has its own sentence, never the generic fallback", () => {
    for (const tool of WORK_TOOL_IDS) {
      for (const gated of [false, true]) {
        const { title } = describeAuditEntry({
          action: "tool.called",
          actorType: "agent",
          metadata: { tool, ok: true, gated, input: {}, result: "Delegated task to Max (Marketer) as task x." },
        });
        expect(title, tool).not.toMatch(/^(Used|Tried to use) /);
      }
    }
  });
});
