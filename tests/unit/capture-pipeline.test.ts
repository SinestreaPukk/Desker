import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractRuleBased } from "@/lib/capture/extraction";

vi.mock("@/lib/platform/db", () => ({
  prisma: {
    lifeEntry: { create: vi.fn(), delete: vi.fn() },
    lifeEvent: { create: vi.fn(), delete: vi.fn() },
    lifeTask: { create: vi.fn(), delete: vi.fn() },
    capturedItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryRecord: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/memory/store", () => ({
  saveMemory: vi.fn().mockResolvedValue({
    memory: { id: "mem-note-1", fact: "Friday dinner with Nok" },
    message: "Noted: Friday dinner with Nok",
  }),
}));

import { prisma } from "@/lib/platform/db";
import { processIntake, switchClassification } from "@/lib/capture/pipeline";

describe("capture extraction", () => {
  it("extracts English and Thai bills with payee, amount and due date", () => {
    // English electricity bill
    const billEng = "Electricity bill from MEA: 1,240 Baht, due 18 Oct 2026, Ref: 9876543210";
    const resEng = extractRuleBased(billEng);
    expect(resEng.classification).toBe("bill");
    expect(resEng.billData).toBeDefined();
    expect(resEng.billData?.payee).toBe("MEA Electricity");
    expect(resEng.billData?.amountMajor).toBe(1240);
    expect(resEng.billData?.amountMinor).toBe(124000);
    expect(resEng.billData?.referenceNumber).toBe("9876543210");
    expect(resEng.confidence).toBeGreaterThanOrEqual(0.75);

    // Thai water bill
    const billThai = "ใบแจ้งหนี้ ค่าน้ำประปา การประปานครหลวง ยอดเงิน 450.50 บาท กำหนดชำระ 20/10/2026";
    const resThai = extractRuleBased(billThai);
    expect(resThai.classification).toBe("bill");
    expect(resThai.billData?.payee).toBe("MWA Water");
    expect(resThai.billData?.amountMajor).toBe(450.5);
    expect(resThai.billData?.amountMinor).toBe(45050);
  });

  it("handles ambiguity: picks event and offers note as altClassification", () => {
    const text = "Friday dinner with Nok at 19:00";
    const res = extractRuleBased(text);
    expect(res.classification).toBe("event");
    expect(res.altClassification).toBe("note");
    expect(res.eventData?.title).toContain("dinner with Nok");
  });

  it("flags uncertain fields when bill details are incomplete", () => {
    // Bill with amount but no due date
    const partial = "Paid 500 baht to Coffee Shop";
    const res = extractRuleBased(partial);
    expect(res.classification).toBe("bill");
    expect(res.uncertainFields).toContain("dueDate");
  });

  it("classifies task statements cleanly", () => {
    const taskText = "Remember to send contract to Nok";
    const res = extractRuleBased(taskText);
    expect(res.classification).toBe("task");
    expect(res.taskData?.title).toBe(taskText);
  });
});

describe("processIntake pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a LifeEntry for a clear bill and confirms in one line", async () => {
    vi.mocked(prisma.lifeEntry.create).mockResolvedValue({ id: "bill-entry-1" } as never);
    vi.mocked(prisma.capturedItem.create).mockResolvedValue({
      id: "cap-1",
      projectId: "proj-1",
      inputType: "text",
      classification: "bill",
      confidence: 0.9,
      headline: "MEA Electricity bill",
      rawContent: "Electricity bill from MEA: 1,240 Baht, due 18 Oct 2026",
      extractedData: { payee: "MEA Electricity", amountMajor: 1240, currency: "THB" },
      uncertainFields: [],
      status: "created",
      targetType: "LifeEntry",
      targetId: "bill-entry-1",
      sourceRef: "line:123",
      sourceChannel: "line",
      altClassification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await processIntake({
      projectId: "proj-1",
      organizationId: "org-1",
      inputType: "text",
      text: "Electricity bill from MEA: 1,240 Baht, due 18 Oct 2026",
      sourceRef: "line:123",
      sourceChannel: "line",
    });

    expect(prisma.lifeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payee: "MEA Electricity",
          amountMinor: 124000,
          currency: "THB",
          source: "capture",
          sourceRef: "line:123",
        }),
      }),
    );
    expect(result.confirmationText).toContain("1,240 THB");
    expect(result.isLowConfidence).toBe(false);
  });

  it("switches classification and cleans up previous target", async () => {
    vi.mocked(prisma.capturedItem.findUnique).mockResolvedValue({
      id: "cap-ambiguous",
      projectId: "proj-1",
      inputType: "text",
      classification: "event",
      confidence: 0.8,
      headline: "Friday dinner with Nok",
      rawContent: "Friday dinner with Nok",
      extractedData: {},
      uncertainFields: null,
      status: "created",
      targetType: "LifeEvent",
      targetId: "event-1",
      sourceRef: null,
      sourceChannel: "line",
      altClassification: "note",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.lifeEvent.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.capturedItem.update).mockResolvedValue({} as never);

    const res = await switchClassification("cap-ambiguous", "note");
    expect(res.ok).toBe(true);
    expect(prisma.lifeEvent.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
    expect(prisma.capturedItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cap-ambiguous" },
        data: expect.objectContaining({
          classification: "note",
          targetType: "MemoryRecord",
        }),
      }),
    );
  });
});
