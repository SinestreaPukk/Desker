import { describe, expect, it } from "vitest";
import { extractRuleBased } from "@/lib/capture/extraction";

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
