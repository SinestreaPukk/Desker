/**
 * The reporting layer's pure parts: reading a model's JSON back, the digest
 * schedule and window arithmetic, and the deterministic fallbacks that stand
 * in when no model is configured.
 */
import { describe, expect, it } from "vitest";
import { clamp, firstSentences, parseModelJson, stringField } from "@/lib/work/model-json";
import { digestCron, digestWindow, fallbackDigest, MAX_DIGEST_BULLETS } from "@/lib/work/digest";
import { fallbackSummary } from "@/lib/work/summary";
import { isPending } from "@/lib/work/suggestions";
import { DIGEST_CADENCES, isDigestCadence } from "@/lib/work/types";

describe("reading a model's JSON", () => {
  it("takes a bare object", () => {
    expect(parseModelJson('{"headline":"Done","summary":"All good."}')).toEqual({
      headline: "Done",
      summary: "All good.",
    });
  });

  it("survives a code fence and surrounding chatter", () => {
    const fenced = 'Sure!\n```json\n{"headline":"Done"}\n```\nHope that helps.';
    expect(parseModelJson(fenced)).toEqual({ headline: "Done" });
  });

  it("ignores braces inside strings when finding the object", () => {
    const text = 'here: {"summary":"a } brace","ok":true} trailing';
    expect(parseModelJson(text)).toEqual({ summary: "a } brace", ok: true });
  });

  it("returns null for prose, arrays and nonsense", () => {
    expect(parseModelJson("I could not do that.")).toBeNull();
    expect(parseModelJson("[1,2,3]")).toBeNull();
    expect(parseModelJson("")).toBeNull();
    expect(parseModelJson("{oops")).toBeNull();
  });

  it("reads string fields defensively", () => {
    expect(stringField({ a: "  x  " }, "a")).toBe("x");
    expect(stringField({ a: 4 }, "a")).toBe("");
    expect(stringField(null, "a")).toBe("");
  });
});

describe("trimming text for a card", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(clamp("  two   words ", 40)).toBe("two words");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const cut = clamp("the quick brown fox jumps over the lazy dog", 20);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(21);
    expect(cut).not.toContain("jumps over");
  });

  it("takes whole sentences for a fallback summary", () => {
    const text = "One thing happened. Then another. And a third.";
    expect(firstSentences(text, 2)).toBe("One thing happened. Then another.");
    // No sentence punctuation at all: keep what there is rather than nothing.
    expect(firstSentences("no full stop here", 2)).toBe("no full stop here");
  });
});

describe("the digest schedule", () => {
  it("fires in the morning, weekly on a Monday", () => {
    expect(digestCron("daily")).toBe("0 8 * * *");
    expect(digestCron("weekly")).toBe("0 8 * * 1");
    expect(digestCron("off")).toBeNull();
  });

  it("knows its own cadences", () => {
    for (const cadence of DIGEST_CADENCES) expect(isDigestCadence(cadence)).toBe(true);
    expect(isDigestCadence("fortnightly")).toBe(false);
  });

  it("covers one cadence back on the first digest", () => {
    const end = new Date("2026-09-21T08:00:00Z");
    const { periodStart } = digestWindow("weekly", end, null);
    expect(periodStart.toISOString()).toBe("2026-09-14T08:00:00.000Z");
  });

  it("starts where the last one ended", () => {
    const end = new Date("2026-09-21T08:00:00Z");
    const last = new Date("2026-09-19T08:00:00Z");
    expect(digestWindow("weekly", end, last).periodStart).toEqual(last);
  });

  it("never reaches back more than four cadences after a long gap", () => {
    const end = new Date("2026-09-21T08:00:00Z");
    const ancient = new Date("2026-01-01T08:00:00Z");
    const { periodStart } = digestWindow("daily", end, ancient);
    expect(periodStart.toISOString()).toBe("2026-09-20T08:00:00.000Z");
  });
});

function facts(overrides: Partial<Parameters<typeof fallbackDigest>[0]> = {}) {
  return {
    agentName: "Sam",
    jobTitle: "Content Marketer",
    cadence: "weekly" as const,
    periodStart: new Date("2026-09-14T08:00:00Z"),
    periodEnd: new Date("2026-09-21T08:00:00Z"),
    runs: [],
    awaiting: [],
    suggestions: [],
    drafts: 0,
    ...overrides,
  };
}

describe("the digest written without a model", () => {
  it("leads with what needs a decision and caps its length", () => {
    const digest = fallbackDigest(
      facts({
        runs: Array.from({ length: 9 }, (_, i) => ({
          id: `r${i}`,
          status: i === 0 ? "failed" : "done",
          headline: `Task ${i}`,
          summary: `Did thing ${i}.`,
          error: i === 0 ? "The search provider timed out" : null,
          createdAt: new Date("2026-09-15T08:00:00Z"),
        })),
        awaiting: [
          { id: "a1", headline: "A post", tool: "publish_post", since: new Date("2026-09-16T08:00:00Z") },
        ],
        suggestions: [{ summary: "Two rivals raised prices", proposal: "Email the affected accounts" }],
        drafts: 3,
      }),
    );

    expect(digest.bullets.length).toBeLessThanOrEqual(MAX_DIGEST_BULLETS);
    expect(digest.bullets[0]!.kind).toBe("heads_up");
    expect(digest.bullets[0]!.text).toContain("Two rivals raised prices");
    expect(digest.bullets.some((b) => b.kind === "pending" && b.text.includes("approval"))).toBe(true);
    expect(digest.headline).toContain("failed");
  });

  it("says so plainly when a period held nothing", () => {
    const digest = fallbackDigest(facts());
    expect(digest.bullets).toHaveLength(1);
    expect(digest.headline).toBe("A quiet period");
  });
});

function runFacts(overrides: Partial<Parameters<typeof fallbackSummary>[0]> = {}) {
  return {
    agentName: "Sam",
    jobTitle: "Content Marketer",
    trigger: "schedule",
    status: "done",
    report: "Ran the weekly sweep. Two competitors changed pricing.",
    error: null,
    escalationReason: null,
    pendingTool: null,
    steps: [],
    drafts: [],
    findings: [],
    ...overrides,
  };
}

describe("the run summary written without a model", () => {
  it("counts what actually happened and keeps the agent's own words", () => {
    const summary = fallbackSummary(
      runFacts({
        steps: [
          { at: "", tool: "web_research", input: {}, output: "", ok: true },
          { at: "", tool: "draft_content", input: {}, output: "", ok: true },
        ],
        drafts: [{ kind: "social_caption", title: "Warranty launch" }],
      }),
    );
    expect(summary.summary).toContain("1 piece of research");
    expect(summary.summary).toContain("wrote 1 draft");
    expect(summary.summary).toContain("Two competitors changed pricing");
    expect(summary.headline).toBe("Drafted Warranty launch");
    expect(summary.suggestion).toBeNull();
  });

  it("puts a failure first and names it", () => {
    const summary = fallbackSummary(runFacts({ status: "failed", error: "The model refused" }));
    expect(summary.summary.startsWith("This task failed")).toBe(true);
    expect(summary.headline).toBe("The task failed");
  });

  it("tells the owner when something is waiting on them", () => {
    const summary = fallbackSummary(runFacts({ status: "needs_approval", pendingTool: "send_email" }));
    expect(summary.summary).toContain("nothing has been sent");
    expect(summary.headline).toBe("Waiting for your approval");
  });
});

describe("a snoozed suggestion", () => {
  const now = new Date("2026-09-21T08:00:00Z");

  it("is out of the way until its date, then back in front of the owner", () => {
    expect(isPending({ status: "open", snoozedUntil: null }, now)).toBe(true);
    expect(isPending({ status: "snoozed", snoozedUntil: new Date("2026-09-28T08:00:00Z") }, now)).toBe(false);
    expect(isPending({ status: "snoozed", snoozedUntil: new Date("2026-09-20T08:00:00Z") }, now)).toBe(true);
    expect(isPending({ status: "accepted", snoozedUntil: null }, now)).toBe(false);
    expect(isPending({ status: "dismissed", snoozedUntil: null }, now)).toBe(false);
  });
});
