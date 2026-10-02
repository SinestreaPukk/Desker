/**
 * The life-context snapshot: one typed picture of the person's near future and
 * recent past, read by every agent, the chat and the reasoning engine.
 * `buildLife` is pure (rows in, picture out) so the numbers are tested; the
 * model is only ever shown figures computed here, never asked to add them up.
 */
import type { LifeEvent, LifeEntry, LifeTask, LifeGoal, LifeWorkout, LifePreference, LifeNote } from "@prisma/client";

const DAY = 86_400_000;

export interface LifeRows {
  events: LifeEvent[];
  entries: LifeEntry[];
  tasks: LifeTask[];
  goals: LifeGoal[];
  workouts: LifeWorkout[];
  prefs: LifePreference[];
  notes: LifeNote[];
}

export interface Life {
  now: Date;
  events: LifeEvent[]; // next 30 days, confirmed/tentative, soonest first
  openTasks: LifeTask[];
  goals: LifeGoal[];
  workouts: LifeWorkout[]; // planned, next 30 days
  prefs: Record<string, string>;
  notes: LifeNote[];
  money: {
    currency: string;
    monthSpendMinor: number;
    monthIncomeMinor: number;
    /** From the preference "monthly_budget" (major units), if set. */
    monthBudgetMinor: number | null;
    unpaidBills: LifeEntry[]; // soonest due first
    billsDueSoonMinor: number; // unpaid and due within 7 days or overdue
    topCategories: { category: string; minor: number }[];
  };
}

export function buildLife(rows: LifeRows, now = new Date()): Life {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const horizon = new Date(now.getTime() + 30 * DAY);
  const inMonth = rows.entries.filter((e) => e.occurredAt >= monthStart && e.occurredAt <= now);
  const spend = inMonth.filter((e) => e.kind === "expense");
  const byCat = new Map<string, number>();
  for (const e of spend) byCat.set(e.category ?? "other", (byCat.get(e.category ?? "other") ?? 0) + e.amountMinor);
  const unpaidBills = rows.entries
    .filter((e) => e.kind === "bill" && e.status !== "paid")
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const prefs = Object.fromEntries(rows.prefs.map((p) => [p.key, p.value]));
  const budget = Number(prefs.monthly_budget);
  return {
    now,
    events: rows.events
      .filter((e) => e.status !== "cancelled" && (e.endsAt ?? e.startsAt) >= now && e.startsAt <= horizon)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    openTasks: rows.tasks
      .filter((t) => t.status === "open")
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)),
    goals: rows.goals.filter((g) => g.status === "active"),
    workouts: rows.workouts
      .filter((w) => w.status === "planned" && w.scheduledAt >= now && w.scheduledAt <= horizon)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
    prefs,
    notes: rows.notes,
    money: {
      currency: rows.entries[0]?.currency ?? "THB",
      monthSpendMinor: spend.reduce((s, e) => s + e.amountMinor, 0),
      monthIncomeMinor: inMonth.filter((e) => e.kind === "income").reduce((s, e) => s + e.amountMinor, 0),
      monthBudgetMinor: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : null,
      unpaidBills,
      billsDueSoonMinor: unpaidBills
        .filter((b) => b.occurredAt.getTime() <= now.getTime() + 7 * DAY)
        .reduce((s, b) => s + b.amountMinor, 0),
      topCategories: [...byCat].map(([category, minor]) => ({ category, minor })).sort((a, b) => b.minor - a.minor).slice(0, 5),
    },
  };
}

const fmt = (minor: number, cur: string) => `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`;
const day = (d: Date, tz?: string) => d.toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The text block put in front of every agent and the chat. Figures are computed, not for the model to add up. */
export function renderLife(life: Life, tz?: string): string {
  const { money: m } = life;
  const lines: string[] = [];
  lines.push(
    `Money this month: spent ${fmt(m.monthSpendMinor, m.currency)}, income ${fmt(m.monthIncomeMinor, m.currency)}` +
      (m.monthBudgetMinor ? `, budget ${fmt(m.monthBudgetMinor, m.currency)} (${fmt(m.monthBudgetMinor - m.monthSpendMinor, m.currency)} left)` : ", no budget set") + ".",
  );
  if (m.topCategories.length) lines.push(`Top categories: ${m.topCategories.map((c) => `${c.category} ${fmt(c.minor, m.currency)}`).join("; ")}.`);
  if (m.unpaidBills.length)
    lines.push(`Unpaid bills (${fmt(m.billsDueSoonMinor, m.currency)} due within 7 days or overdue):\n${m.unpaidBills.slice(0, 8).map((b) => `- ${b.payee} ${fmt(b.amountMinor, b.currency)} due ${day(b.occurredAt, tz)}`).join("\n")}`);
  if (life.events.length) lines.push(`Calendar, next 30 days:\n${life.events.slice(0, 15).map((e) => `- ${day(e.startsAt, tz)}${e.endsAt ? ` to ${day(e.endsAt, tz)}` : ""} ${e.title}${e.status === "tentative" ? " (tentative)" : ""}`).join("\n")}`);
  if (life.openTasks.length) lines.push(`Open tasks and reminders:\n${life.openTasks.slice(0, 12).map((t) => `- ${t.title}${t.dueAt ? ` (due ${day(t.dueAt, tz)})` : ""}`).join("\n")}`);
  if (life.workouts.length) lines.push(`Planned workouts:\n${life.workouts.slice(0, 10).map((w) => `- ${day(w.scheduledAt, tz)} ${w.title}`).join("\n")}`);
  if (life.goals.length) lines.push(`Goals:\n${life.goals.map((g) => `- [${g.domain}] ${g.title}${g.target ? ` (target ${g.target})` : ""}${g.deadline ? ` by ${day(g.deadline, tz)}` : ""}`).join("\n")}`);
  const prefs = Object.entries(life.prefs);
  if (prefs.length) lines.push(`Preferences:\n${prefs.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);
  if (life.notes.length) lines.push(`Recent notes (newest first):\n${life.notes.map((n) => `- ${n.text}`).join("\n")}`);
  return lines.join("\n\n");
}
