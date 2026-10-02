import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn() } }));
import { parseReminderJson, REMIND, SHORT_WAIT_MS } from "@/lib/life/reminders";
import { dueAlerts } from "@/lib/life/alerts";
import { buildLife } from "@/lib/life/context";

const now = new Date("2026-10-10T09:00:00Z");

describe("reminders", () => {
  it("recognises the ask in English and Thai", () => {
    expect(REMIND.test("Remind me to work in 30 seconds")).toBe(true);
    expect(REMIND.test("เตือนฉันทำงานอีก 30 วินาที")).toBe(true);
    expect(REMIND.test("what is a reminder app")).toBe(false);
  });
  it("accepts a future time and rejects a missing or already-past one", () => {
    expect(parseReminderJson({ what: "Work", at: "2026-10-10T09:00:30Z" }, now)).toEqual({ what: "Work", at: new Date("2026-10-10T09:00:30Z") });
    expect(parseReminderJson({ what: "Work", at: "" }, now)).toBeNull();
    expect(parseReminderJson({ what: "Work", at: "2026-10-10T02:00:00Z" }, now)).toBeNull();
  });
  it("waits in-process only when the time is close", () => {
    expect(SHORT_WAIT_MS).toBeLessThan(300_000);
  });
  it("the sweep sends a due reminder, but not one still in the future, and a task keeps its day-ahead notice", () => {
    const row = { projectId: "p", createdAt: now, updatedAt: now, source: "chat", externalId: null, status: "open" };
    const life = buildLife({ events: [], goals: [], notes: [], prefs: [], entries: [], workouts: [],
      tasks: [
        { ...row, id: "r1", title: "Work", kind: "reminder", dueAt: new Date("2026-10-10T08:59:00Z") },
        { ...row, id: "r2", title: "Later", kind: "reminder", dueAt: new Date("2026-10-10T10:00:00Z") },
        { ...row, id: "t1", title: "Form", kind: "task", dueAt: new Date("2026-10-10T20:00:00Z") },
      ] } as never, now);
    expect(dueAlerts(life, now).map((a) => a.key).sort()).toEqual(["reminder:r1", "task:t1"]);
  });
});
