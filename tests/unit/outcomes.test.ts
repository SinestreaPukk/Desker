import { describe, expect, it } from "vitest";
import { outcomeOf, roleOf, summarizeOutcomes, type OutcomeRun } from "@/lib/work/outcomes";

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 1, 9, minutes));
const run = (over: Partial<OutcomeRun>): OutcomeRun => ({
  id: Math.random().toString(36).slice(2),
  agentId: "a1",
  status: "done",
  type: "scope_run",
  awaitingSince: null,
  approvedAt: null,
  completedAt: null,
  createdAt: at(0),
  parentAgentId: null,
  ...over,
});

describe("outcomes", () => {
  it("counts rework as rejected or edited before approval, and failure over finished runs", () => {
    const edited = run({ id: "e", status: "done", awaitingSince: at(0), approvedAt: at(30) });
    const runs = [
      run({ status: "done", awaitingSince: at(0), approvedAt: at(10) }),
      edited,
      run({ status: "rejected", awaitingSince: at(0), completedAt: at(50) }),
      run({ status: "failed" }),
      run({ status: "needs_approval", awaitingSince: at(0) }),
    ];
    const outcome = outcomeOf(runs, new Set(["e"]));
    expect(outcome).toMatchObject({ approvedAsIs: 1, approvedEdited: 1, rejected: 1, done: 2, failed: 1 });
    expect(outcome.reworkRate).toBeCloseTo(2 / 3);
    expect(outcome.failureRate).toBeCloseTo(1 / 3);
    expect(outcome.approvalMedianMs).toBe(30 * 60_000);
  });

  it("says nothing rather than zero when there is nothing to measure", () => {
    expect(outcomeOf([], new Set())).toMatchObject({ reworkRate: null, failureRate: null, approvalMedianMs: null });
  });

  it("groups by role, from the template or the job title", () => {
    expect(roleOf({ templateId: "money-manager", jobTitle: "Anything" }).name).toBe("Money");
    expect(roleOf({ templateId: null, jobTitle: "social media manager" }).name).toBe("Social media");
    expect(roleOf({ templateId: null, jobTitle: "Night Owl" }).id).toBe("custom:night owl");
  });

  it("ranks hand-offs by how often their work is rejected", () => {
    const agents = [
      { id: "r", name: "Sol", jobTitle: "Money Manager", templateId: "money-manager" },
      { id: "m", name: "Nova", jobTitle: "Social Media Manager", templateId: "social-media-manager" },
    ];
    const summary = summarizeOutcomes({
      agents,
      edited: new Set(),
      runs: [
        run({ agentId: "r" }),
        run({ agentId: "m", type: "colleague_delegation", parentAgentId: "r", status: "rejected", awaitingSince: at(0), completedAt: at(5) }),
      ],
    });
    expect(summary.byHandoff[0]).toMatchObject({ from: "Money", to: "Social media", rejected: 1, reworkRate: 1 });
    expect(summary.byRole.map((r) => r.roleName)).toEqual(["Money", "Social media"]);
  });
});
