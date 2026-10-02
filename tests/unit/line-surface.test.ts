import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { approvalFlex, parsePostback, postbackData, richMenuDefinition } from "@/lib/messaging/line";
import { parseLineCommand } from "@/lib/messaging/line-handler";
import { previewPending } from "@/lib/work/pending-preview";
import { dueAlerts } from "@/lib/life/alerts";
import { buildLife } from "@/lib/life/context";

describe("LINE approvals", () => {
  it("round-trips a postback and rejects junk", () => {
    expect(parsePostback(postbackData("approve", "cmur493nr00015fu7g10b2oyr"))).toEqual({ action: "approve", id: "cmur493nr00015fu7g10b2oyr" });
    expect(parsePostback("a=approve&id=../../etc")).toBeNull();
    expect(parsePostback("a=delete&id=cmur493nr00015fu7g10b2oyr")).toBeNull();
  });
  it("shows the exact payload before the buttons, and nothing is a link that executes", () => {
    const p = previewPending({ tool: "phone_send", input: { kind: "sms", to: "+66812345678", message: "Running late" } });
    const flex = JSON.stringify(approvalFlex({ actionItemId: "cmur493nr00015fu7g10b2oyr", agent: "Gebby", ...p }));
    expect(flex).toContain("+66812345678");
    expect(flex).toContain("Running late");
    expect(flex).toContain('"type":"postback"');
    expect(flex).not.toMatch(/"uri":"[^"]*approve/);
  });
});

describe("rich menu and commands", () => {
  it("has six tiles inside the canvas, one opening the photo library", () => {
    const m = richMenuDefinition();
    expect(m.areas).toHaveLength(6);
    expect(m.areas.every((a) => a.bounds.x + a.bounds.width <= 2500 && a.bounds.y + a.bounds.height <= 1686)).toBe(true);
    expect(m.areas.some((a) => a.action.type === "cameraRoll")).toBe(true);
  });
  it("reads menu words in English and Thai", () => {
    expect(parseLineCommand("Budget")).toBe("budget");
    expect(parseLineCommand("บิล")).toBe("bills");
    expect(parseLineCommand("hello")).toBeNull();
  });
});

describe("proactive alerts", () => {
  const now = new Date("2026-10-10T09:00:00Z");
  const row = { id: "x", projectId: "p", createdAt: now, updatedAt: now };
  const life = buildLife({
    events: [], goals: [], notes: [], prefs: [],
    entries: [{ ...row, id: "b1", kind: "bill", payee: "Power", amountMinor: 150_000, currency: "THB", category: null, occurredAt: new Date("2026-10-11T09:00:00Z"), status: "unpaid", lineItems: null, source: "manual", sourceRef: null }],
    tasks: [{ ...row, id: "t1", title: "Tax form", kind: "task", dueAt: new Date("2026-10-10T20:00:00Z"), status: "open", source: "user", externalId: null }],
    workouts: [{ ...row, id: "w1", title: "Run", scheduledAt: new Date("2026-10-10T10:00:00Z"), durationMin: 60, status: "planned", notes: null, source: "user" }],
  } as never, now);
  it("finds the bill, deadline and workout once each, with stable keys", () => {
    const a = dueAlerts(life, now);
    expect(a.map((x) => x.key).sort()).toEqual(["bill:b1", "task:t1", "workout:w1"]);
    expect(dueAlerts(life, now).map((x) => x.key)).toEqual(a.map((x) => x.key));
  });
});
