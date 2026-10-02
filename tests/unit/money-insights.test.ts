import { describe, expect, it } from "vitest";
import { moneyInsights } from "@/lib/life/money-insights";

const now = new Date("2026-10-15T09:00:00Z");
let n = 0;
const e = (kind: string, payee: string, baht: number, date: string, category = "food", status: string | null = null) =>
  ({ id: `e${n++}`, kind, payee, amountMinor: baht * 100, currency: "THB", category, occurredAt: new Date(date), status }) as never;

describe("money insights", () => {
  const entries = [
    e("expense", "Cafe", 100, "2026-09-03"), e("expense", "Cafe", 120, "2026-09-05"), e("expense", "Cafe", 110, "2026-09-09"),
    e("expense", "Cafe", 100, "2026-10-02"), e("expense", "Cafe", 100, "2026-10-04"), e("expense", "Cafe", 100, "2026-10-06"),
    e("expense", "Omakase", 2000, "2026-10-10"),
    e("bill", "Power", 1500, "2026-10-12", "bills", "unpaid"),
    e("bill", "Internet", 600, "2026-10-20", "bills", "unpaid"),
  ];
  const r = moneyInsights(entries, now, 500_000);

  it("totals the trend and categories in code", () => {
    expect(r.trend.at(-1)!.spendMinor).toBe(230_000);
    expect(r.categories[0]).toMatchObject({ category: "food", minor: 230_000 });
  });
  it("flags the odd charge and the overdue bill", () => {
    expect(r.anomalies.map((a) => a.payee)).toEqual(["Omakase"]);
    expect(r.bills.map((b) => b.risk)).toEqual(["overdue", "soon"]);
    expect(r.insights.join(" ")).toContain("overdue: Power");
  });
});
