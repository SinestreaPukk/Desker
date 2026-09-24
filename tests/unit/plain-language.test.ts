/**
 * The promise this phase makes: nothing an owner reads requires knowing what
 * a token is, what a status code means, or what the engineering team called
 * something internally. These pin the two layers that do the translating.
 */
import { describe, expect, it } from "vitest";
import {
  awaitingCaption,
  conversationsCaption,
  costCaption,
  describeChange,
  escalationCaption,
  failedCaption,
  formatHours,
  helpfulCaption,
  humanCost,
  humanDuration,
  issuesCaption,
  searchesCaption,
  tasksCaption,
  timeSaved,
} from "@/lib/insight-copy";
import { actorWords, dayHeading, describeAuditEntry, timeOfDay } from "@/lib/audit-copy";

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

describe("saying which way a number is going", () => {
  it("names the direction and the size of the change", () => {
    expect(describeChange(56, 50)).toBe("up 12% on the period before");
    expect(describeChange(44, 50)).toBe("down 12% on the period before");
    expect(describeChange(50, 50)).toBe("the same as the period before");
  });

  it("says nothing rather than something false when there is nothing to compare", () => {
    expect(describeChange(0, 0)).toBeNull();
    expect(describeChange(9, 0)).toBe("first activity in this range");
  });
});

describe("the captions under the numbers", () => {
  it("say what the number is, how it moved, and what it means", () => {
    const caption = conversationsCaption({
      conversations: 42,
      previousConversations: 37,
      escalated: 4,
      days: 7,
    });
    expect(caption).toContain("42 client conversations");
    expect(caption).toContain("this week");
    expect(caption).toContain("up 14%");
    expect(caption).toContain("90% finished without needing a person");
    expectPlain(caption);
  });

  it("tell an owner what to do when a figure is bad", () => {
    expect(escalationCaption(45, 100)).toContain("out of its depth");
    expect(escalationCaption(5, 100)).toContain("Normal");
    expect(failedCaption(3, 30)).toContain("says why under Work");
    expect(searchesCaption(20, 6)).toContain("questions listed below");
  });

  it("handle the empty case without a dash or a zero", () => {
    for (const caption of [
      conversationsCaption({ conversations: 0, previousConversations: 0, escalated: 0, days: 30 }),
      escalationCaption(0, 0),
      helpfulCaption(0, 0),
      searchesCaption(0, 0),
      issuesCaption(0, 0),
      tasksCaption({ runs: 0, previousRuns: 0, done: 0, failed: 0, awaiting: 0, days: 30 }),
      failedCaption(0, 0),
      awaitingCaption(0, null),
    ]) {
      expect(caption.length).toBeGreaterThan(15);
      expect(caption).not.toContain("—");
      expectPlain(caption);
    }
  });

  it("never mention tokens where cost is the point", () => {
    const caption = costCaption({
      costUsd: 1.5,
      runs: 20,
      conversations: 30,
      unpricedModels: [],
      days: 30,
    });
    expect(caption).toContain("$1.50");
    expect(caption).toContain("about $0.03 each");
    expectPlain(caption);

    // The figure most owners will see first: a few pennies over a month.
    const small = costCaption({
      costUsd: 0.2,
      runs: 20,
      conversations: 30,
      unpricedModels: [],
      days: 30,
    });
    expect(small).toContain("under a penny each");
  });

  it("say when a cost figure is incomplete rather than quietly understating it", () => {
    const caption = costCaption({
      costUsd: 0.2,
      runs: 2,
      conversations: 0,
      unpricedModels: ["some-model"],
      days: 30,
    });
    expect(caption).toContain("higher than this");
  });
});

describe("durations and money, for people", () => {
  it("rounds to something sayable", () => {
    expect(humanDuration(30_000)).toBe("under a minute");
    expect(humanDuration(20 * 60_000)).toBe("about 20 minutes");
    expect(humanDuration(3 * 3_600_000)).toBe("about 3 hours");
    expect(humanDuration(4 * 86_400_000)).toBe("about 4 days");
  });

  it("never shows a fraction of a cent as $0.00", () => {
    expect(humanCost(0.004)).toBe("under a penny");
    expect(humanCost(0)).toBe("no charge yet");
    expect(humanCost(null)).toBe("not priced");
    expect(humanCost(12.5)).toBe("$12.50");
  });

  it("estimates time saved and says that it is an estimate", () => {
    const saved = timeSaved(4, 2);
    expect(saved.hours).toBeCloseTo(2, 5);
    expect(saved.caption).toContain("rough estimate");
    expect(formatHours(saved.hours)).toBe("2.0 h");
    expect(formatHours(0.5)).toBe("30 min");
  });
});

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
    expect(timeOfDay("2026-09-23T09:03:00Z", "en-US")).toMatch(/^\d{1,2}:\d{2}(am|pm)$/);
  });

  it("groups by today, yesterday, then the date", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(dayHeading("2026-09-23T09:00:00Z", now, "en-GB")).toBe("Today");
    expect(dayHeading("2026-09-22T09:00:00Z", now, "en-GB")).toBe("Yesterday");
    expect(dayHeading("2026-09-18T09:00:00Z", now, "en-GB")).toBe("18 September");
    expect(dayHeading("2025-09-18T09:00:00Z", now, "en-GB")).toBe("18 September 2025");
  });
});
