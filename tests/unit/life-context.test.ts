import { describe, expect, it } from "vitest";
import { buildLife, renderLife } from "@/lib/life/context";

const now = new Date("2026-10-10T09:00:00Z");
const d = (s: string) => new Date(s);
const base = { id: "x", projectId: "p", createdAt: now, updatedAt: now };

describe("life context", () => {
  it("computes month spend, budget left and bills due soon in code", () => {
    const entry = (o: object) => ({ ...base, currency: "THB", category: null, status: null, lineItems: null, source: "manual", sourceRef: null, ...o }) as never;
    const life = buildLife(
      {
        events: [], tasks: [], goals: [], workouts: [], notes: [],
        prefs: [{ ...base, key: "monthly_budget", value: "1000" }],
        entries: [
          entry({ kind: "expense", payee: "Cafe", amountMinor: 30000, category: "food", occurredAt: d("2026-10-02T00:00:00Z") }),
          entry({ kind: "expense", payee: "Old", amountMinor: 99900, occurredAt: d("2026-09-02T00:00:00Z") }),
          entry({ kind: "bill", payee: "Power", amountMinor: 50000, occurredAt: d("2026-10-12T00:00:00Z"), status: "unpaid" }),
          entry({ kind: "bill", payee: "Later", amountMinor: 70000, occurredAt: d("2026-11-30T00:00:00Z"), status: "unpaid" }),
        ],
      } as never,
      now,
    );
    expect(life.money.monthSpendMinor).toBe(30000);
    expect(life.money.monthBudgetMinor).toBe(100000);
    expect(life.money.billsDueSoonMinor).toBe(50000);
    expect(renderLife(life)).toContain("700 THB left");
  });
});
