/**
 * Cross-domain conflict detection: the facts the negotiation layer argues
 * over. Pure code over the shared life context, so "this trip blows the
 * budget by 4,000" is computed, not guessed. A proposal (a trip, a new
 * commitment) is laid over the context as if it were accepted, and the same
 * detectors run, which is how a travel idea gets checked against money,
 * calendar, workouts and deadlines in one pass.
 */
import type { Life } from "./context";
import { localIso, localTimeZone } from "@/lib/shared/local-time";

export type Domain = "money" | "calendar" | "fitness" | "tasks" | "travel";

export interface Conflict {
  kind: "budget" | "overlap" | "workout_clash" | "deadline_in_trip" | "bill_in_trip" | "busy_day";
  domains: Domain[];
  severity: "info" | "warn" | "high";
  summary: string;
  /** Minor units over budget, for budget conflicts. */
  overMinor?: number;
}

export interface Proposal {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** What it adds to spending, minor units; 0 when unknown. */
  costMinor: number;
  trip: boolean;
}

interface Span {
  title: string;
  start: Date;
  end: Date;
  type: "event" | "workout" | "proposal";
  trip: boolean;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const money = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;
const datePart = (d: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(d);
const monthKey = (d: Date, timeZone: string) => Number(datePart(d, timeZone, { year: "numeric" })) * 12 + Number(datePart(d, timeZone, { month: "numeric" }));
const dayKey = (d: Date, timeZone: string) => localIso(d, timeZone).slice(0, 10);
const dayLabel = (d: Date, timeZone: string) => datePart(d, timeZone, { day: "numeric", month: "short" });

function spans(life: Life, proposal?: Proposal): Span[] {
  const out: Span[] = life.events.map((e) => {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + HOUR);
    return { title: e.title, start: e.startsAt, end: e.allDay ? new Date(Math.max(end.getTime(), e.startsAt.getTime() + DAY)) : end, type: "event", trip: e.kind === "trip" };
  });
  for (const w of life.workouts) out.push({ title: w.title, start: w.scheduledAt, end: new Date(w.scheduledAt.getTime() + (w.durationMin ?? 60) * 60_000), type: "workout", trip: false });
  if (proposal) out.push({ title: proposal.title, start: proposal.startsAt, end: proposal.endsAt, type: "proposal", trip: proposal.trip });
  return out;
}

/** Money committed in the month containing `at`: spend so far, bills due that month, and the proposal if it lands there. */
function monthLoad(life: Life, at: Date, proposal: Proposal | undefined, timeZone: string): number {
  const key = monthKey(at, timeZone);
  const bills = life.money.unpaidBills.filter((b) => monthKey(b.occurredAt, timeZone) === key).reduce((s, b) => s + b.amountMinor, 0);
  const spent = monthKey(life.now, timeZone) === key ? life.money.monthSpendMinor : 0;
  return spent + bills + (proposal && monthKey(proposal.startsAt, timeZone) === key ? proposal.costMinor : 0);
}

export function detectConflicts(life: Life, proposal?: Proposal, timeZone = localTimeZone()): Conflict[] {
  const out: Conflict[] = [];
  const cur = life.money.currency;
  const budget = life.money.monthBudgetMinor;

  if (budget) {
    const months = [life.now, ...(proposal ? [proposal.startsAt] : [])];
    for (const at of [...new Map(months.map((d) => [monthKey(d, timeZone), d])).values()]) {
      const load = monthLoad(life, at, proposal, timeZone);
      const label = datePart(at, timeZone, { month: "long" });
      if (load > budget)
        out.push({ kind: "budget", domains: ["money"], severity: "high", overMinor: load - budget, summary: `${label} goes over budget by ${money(load - budget, cur)} (${money(load, cur)} against ${money(budget, cur)}).` });
      else if (load > budget * 0.9)
        out.push({ kind: "budget", domains: ["money"], severity: "warn", overMinor: 0, summary: `${label} would use ${Math.round((load / budget) * 100)}% of the ${money(budget, cur)} budget.` });
    }
  }

  const all = spans(life, proposal);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!, b = all[j]!;
      if (!overlaps(a, b) || (a.type === "workout" && b.type === "workout")) continue;
      const w = a.type === "workout" ? a : b.type === "workout" ? b : null;
      const other = w === a ? b : a;
      if (w)
        out.push({ kind: "workout_clash", domains: ["fitness", other.trip ? "travel" : "calendar"], severity: "warn", summary: `Workout "${w.title}" (${dayLabel(w.start, timeZone)}) clashes with "${other.title}".` });
      else if (!(a.trip && b.trip))
        out.push({ kind: "overlap", domains: ["calendar"], severity: a.trip || b.trip ? "high" : "warn", summary: `"${a.title}" overlaps "${b.title}" on ${dayLabel(a.start < b.start ? b.start : a.start, timeZone)}.` });
    }

  for (const trip of all.filter((s) => s.trip)) {
    for (const t of life.openTasks)
      if (t.dueAt && t.dueAt >= trip.start && t.dueAt <= trip.end)
        out.push({ kind: "deadline_in_trip", domains: ["tasks", "travel"], severity: "warn", summary: `"${t.title}" is due ${dayLabel(t.dueAt, timeZone)}, while you are away on "${trip.title}".` });
    for (const b of life.money.unpaidBills)
      if (b.occurredAt >= trip.start && b.occurredAt <= trip.end)
        out.push({ kind: "bill_in_trip", domains: ["money", "travel"], severity: "info", summary: `${b.payee} bill (${money(b.amountMinor, b.currency)}) falls due ${dayLabel(b.occurredAt, timeZone)}, during "${trip.title}". Pay it before you go.` });
  }

  const perDay = new Map<string, number>();
  for (const e of life.events) {
    const key = dayKey(e.startsAt, timeZone);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  for (const [date, n] of perDay) if (n >= 4) {
    const calendarDay = new Date(`${date}T12:00:00Z`);
    out.push({ kind: "busy_day", domains: ["calendar"], severity: "info", summary: `${datePart(calendarDay, "UTC", { weekday: "long", day: "numeric", month: "short" })} has ${n} events.` });
  }

  const rank = { high: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Same-length windows, a week apart, in the next 8 weeks that raise no warn/high conflict. Soonest first. */
export function cleanWindows(life: Life, proposal: Proposal, count = 2, timeZone = localTimeZone()): { startsAt: Date; endsAt: Date }[] {
  const span = proposal.endsAt.getTime() - proposal.startsAt.getTime();
  const found: { startsAt: Date; endsAt: Date }[] = [];
  for (let w = 1; w <= 8 && found.length < count; w++) {
    const startsAt = new Date(proposal.startsAt.getTime() + w * 7 * DAY);
    if (startsAt <= life.now) continue;
    const shifted = { ...proposal, startsAt, endsAt: new Date(startsAt.getTime() + span) };
    if (!detectConflicts(life, shifted, timeZone).some((c) => c.severity !== "info")) found.push({ startsAt, endsAt: shifted.endsAt });
  }
  return found;
}
