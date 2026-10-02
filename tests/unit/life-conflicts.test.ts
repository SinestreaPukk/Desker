import { describe, expect, it } from "vitest";
import { buildLife } from "@/lib/life/context";
import { cleanWindows, detectConflicts } from "@/lib/life/conflicts";

const now = new Date("2026-06-01T09:00:00Z");
const d = (s: string) => new Date(s);
const row = { id: "x", projectId: "p", createdAt: now, updatedAt: now };

const life = buildLife(
  {
    events: [{ ...row, title: "Launch review", startsAt: d("2026-06-10T10:00:00Z"), endsAt: d("2026-06-10T11:00:00Z"), allDay: false, location: null, kind: "meeting", status: "confirmed", source: "user", externalId: null }],
    tasks: [{ ...row, title: "Submit tax form", kind: "deadline", dueAt: d("2026-06-11T00:00:00Z"), status: "open", source: "user", externalId: null }],
    workouts: [{ ...row, title: "Long run", scheduledAt: d("2026-06-11T07:00:00Z"), durationMin: 90, status: "planned", notes: null, source: "user" }],
    goals: [], notes: [],
    prefs: [{ ...row, key: "monthly_budget", value: "30000" }],
    entries: [
      { ...row, kind: "expense", payee: "Rent", amountMinor: 1_500_000, currency: "THB", category: "home", occurredAt: d("2026-06-01T00:00:00Z"), status: null, lineItems: null, source: "manual", sourceRef: null },
    ],
  } as never,
  now,
);

describe("conflicts", () => {
  it("is quiet when nothing clashes", () => {
    expect(detectConflicts(life).filter((c) => c.severity !== "info")).toEqual([]);
  });

  it("checks a trip against budget, calendar, workouts and deadlines at once", () => {
    const trip = { title: "Chiang Mai trip", startsAt: d("2026-06-09T00:00:00Z"), endsAt: d("2026-06-13T00:00:00Z"), costMinor: 2_000_000, trip: true };
    const found = detectConflicts(life, trip);
    expect(found.find((c) => c.kind === "budget")?.overMinor).toBe(500_000);
    expect(found.map((c) => c.kind)).toEqual(expect.arrayContaining(["overlap", "workout_clash", "deadline_in_trip"]));
  });

  it("finds a later clean week when the budget allows", () => {
    const trip = { title: "Chiang Mai trip", startsAt: d("2026-06-09T00:00:00Z"), endsAt: d("2026-06-13T00:00:00Z"), costMinor: 1_000_000, trip: true };
    const windows = cleanWindows(life, trip);
    expect(windows[0]!.startsAt.getTime()).toBeGreaterThan(trip.endsAt.getTime() - 5 * 86_400_000);
    expect(detectConflicts(life, { ...trip, ...windows[0]! }).some((c) => c.severity !== "info")).toBe(false);
  });
});
