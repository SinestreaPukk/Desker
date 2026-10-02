import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { normalizeSlip } from "@/lib/life/slips";

describe("normalizeSlip", () => {
  it("turns a model read into an entry in minor units, masking long numbers", () => {
    const e = normalizeSlip({ kind: "expense", payee: "Mr. Somchai 0123456789", amount: 120.5, currency: "THB", date: "2026-09-30", category: "food", items: [{ name: "Pad thai", qty: 2, amount: 60.25 }] }, "key");
    expect(e).toMatchObject({ kind: "expense", amountMinor: 12050, category: "food", sourceRef: "key" });
    expect(e!.payee).not.toMatch(/\d{9}/);
    expect((e!.lineItems as { amountMinor: number }[])[0]!.amountMinor).toBe(6025);
  });
  it("marks bills unpaid and rejects junk", () => {
    expect(normalizeSlip({ kind: "bill", payee: "PEA", amount: 800, date: "2026-10-20" })!.status).toBe("unpaid");
    expect(normalizeSlip({ kind: "none" })).toBeNull();
    expect(normalizeSlip({ kind: "expense", payee: "x", amount: -5, date: "2026-10-20" })).toBeNull();
    expect(normalizeSlip({ kind: "expense", payee: "x", amount: 5, date: "1999-01-01" })).toBeNull();
  });
});
