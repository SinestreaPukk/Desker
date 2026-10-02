/**
 * The numbers behind the Money page: spend trend, where this month went, odd
 * charges, and which bills are a risk. Pure over ledger rows so every figure
 * and every sentence is computed and tested, not written by a model.
 */
import type { LifeEntry } from "@prisma/client";

const DAY = 86_400_000;

export interface MoneyInsights {
  currency: string;
  /** Last 6 months, oldest first, minor units. */
  trend: { month: string; spendMinor: number; incomeMinor: number }[];
  categories: { category: string; minor: number; share: number }[];
  anomalies: { id: string; payee: string; amountMinor: number; category: string; reason: string }[];
  bills: { id: string; payee: string; amountMinor: number; dueAt: string; risk: "overdue" | "soon" | "later" }[];
  insights: string[];
}

const fmt = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;
const monthId = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function moneyInsights(entries: Pick<LifeEntry, "id" | "kind" | "payee" | "amountMinor" | "currency" | "category" | "occurredAt" | "status">[], now = new Date(), budgetMinor: number | null = null): MoneyInsights {
  const currency = entries[0]?.currency ?? "THB";
  const months = Array.from({ length: 6 }, (_, i) => monthId(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)));
  const trend = months.map((month) => ({ month, spendMinor: 0, incomeMinor: 0 }));
  for (const e of entries) {
    const row = trend.find((t) => t.month === monthId(e.occurredAt));
    if (!row || e.occurredAt > now) continue;
    if (e.kind === "expense") row.spendMinor += e.amountMinor;
    else if (e.kind === "income") row.incomeMinor += e.amountMinor;
  }

  const thisMonth = entries.filter((e) => e.kind === "expense" && monthId(e.occurredAt) === monthId(now) && e.occurredAt <= now);
  const total = thisMonth.reduce((s, e) => s + e.amountMinor, 0);
  const byCat = new Map<string, number>();
  for (const e of thisMonth) byCat.set(e.category ?? "other", (byCat.get(e.category ?? "other") ?? 0) + e.amountMinor);
  const categories = [...byCat].map(([category, minor]) => ({ category, minor, share: total ? minor / total : 0 })).sort((a, b) => b.minor - a.minor);

  // An odd charge: at least 2.5x the usual in its category (median of the other, earlier ones), and not tiny.
  const anomalies: MoneyInsights["anomalies"] = [];
  for (const e of thisMonth) {
    const peers = entries.filter((p) => p.kind === "expense" && p.id !== e.id && (p.category ?? "other") === (e.category ?? "other") && p.occurredAt < e.occurredAt).map((p) => p.amountMinor).sort((a, b) => a - b);
    if (peers.length < 3) continue;
    const median = peers[Math.floor(peers.length / 2)]!;
    if (e.amountMinor >= median * 2.5 && e.amountMinor >= 50_000)
      anomalies.push({ id: e.id, payee: e.payee, amountMinor: e.amountMinor, category: e.category ?? "other", reason: `${(e.amountMinor / median).toFixed(1)}x your usual ${e.category ?? "other"} spend (${fmt(median, currency)})` });
  }

  const bills = entries
    .filter((e) => e.kind === "bill" && e.status !== "paid")
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((b) => ({ id: b.id, payee: b.payee, amountMinor: b.amountMinor, dueAt: b.occurredAt.toISOString(), risk: (b.occurredAt < now ? "overdue" : b.occurredAt.getTime() - now.getTime() <= 7 * DAY ? "soon" : "later") as "overdue" | "soon" | "later" }));

  const insights: string[] = [];
  const [prev, cur] = [trend[trend.length - 2]!, trend[trend.length - 1]!];
  if (prev.spendMinor > 0 && cur.spendMinor > 0) {
    // Compare like with like: this month so far against the same days of last month.
    const dayOfMonth = now.getDate();
    const prevSoFar = entries.filter((e) => e.kind === "expense" && monthId(e.occurredAt) === prev.month && e.occurredAt.getDate() <= dayOfMonth).reduce((s, e) => s + e.amountMinor, 0);
    if (prevSoFar > 0) {
      const pct = Math.round(((cur.spendMinor - prevSoFar) / prevSoFar) * 100);
      if (Math.abs(pct) >= 10) insights.push(`Spending is ${Math.abs(pct)}% ${pct > 0 ? "higher" : "lower"} than the same days last month.`);
    }
  }
  if (categories[0] && categories[0].share >= 0.35) insights.push(`${categories[0].category} is ${Math.round(categories[0].share * 100)}% of this month's spending (${fmt(categories[0].minor, currency)}).`);
  if (budgetMinor) {
    const left = budgetMinor - cur.spendMinor - bills.filter((b) => monthId(new Date(b.dueAt)) === monthId(now)).reduce((s, b) => s + b.amountMinor, 0);
    insights.push(left >= 0 ? `${fmt(left, currency)} left in this month's budget after unpaid bills.` : `Over this month's budget by ${fmt(-left, currency)} once unpaid bills are counted.`);
  }
  const overdue = bills.filter((b) => b.risk === "overdue");
  if (overdue.length) insights.push(`${overdue.length} bill${overdue.length > 1 ? "s are" : " is"} overdue: ${overdue.map((b) => b.payee).join(", ")}.`);
  else if (bills.some((b) => b.risk === "soon")) insights.push(`${fmt(bills.filter((b) => b.risk === "soon").reduce((s, b) => s + b.amountMinor, 0), currency)} of bills fall due within 7 days.`);
  for (const a of anomalies.slice(0, 2)) insights.push(`${a.payee}: ${a.reason}.`);

  return { currency, trend, categories, anomalies: anomalies.slice(0, 5), bills, insights };
}
