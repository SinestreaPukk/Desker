import { describe, expect, it } from "vitest";
import { PLANS, PLAN_IDS, planFor } from "@/lib/billing/plans";

describe("plans", () => {
  it("every tier is defined, ordered by generosity, and unknown ids fall back to free", () => {
    let previous = 0;
    for (const id of PLAN_IDS) {
      const plan = PLANS[id];
      expect(plan.id).toBe(id);
      expect(plan.limits.publishedAgents).toBeGreaterThan(previous);
      previous = plan.limits.publishedAgents;
    }
    expect(planFor("enterprise").id).toBe("free");
    expect(planFor(null).id).toBe("free");
    expect(PLANS.free.priceUsd).toBe(0);
  });
});
