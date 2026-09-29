import { describe, expect, it } from "vitest";
import {
  describeSpending,
  maskNumbers,
  parseAmount,
  parseDate,
  parseStatement,
  summarizeSpending,
} from "@/lib/money/statement";

const BANK = `Account: 123-4-56789-0,,,
Opening balance,,,
Date,Description,Withdrawal,Deposit,Balance
03/01/2026,SALARY ACME CO,,"85,000.00","90,000.00"
05/01/2026,NETFLIX.COM 866-579,419.00,,"89,581.00"
06/01/2026,TESCO LOTUS SUKHUMVIT,"1,250.50",,"88,330.50"
07/01/2026,GRAB FOOD 4412 8812 3456 7890,320.00,,"88,010.50"
08/01/2026,TRANSFER TO SAVINGS,"10,000.00",,"78,010.50"
03/02/2026,SALARY ACME CO,,"85,000.00","163,010.50"
05/02/2026,NETFLIX.COM 866-579,419.00,,"162,591.50"
14/02/2026,RENT FEBRUARY LANDLORD,"18,000.00",,"144,591.50"
05/03/2026,NETFLIX.COM 866-579,419.00,,"144,172.50"
`;

describe("parsing values", () => {
  it("reads the amount formats banks export", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("(45.00)")).toBe(-45);
    expect(parseAmount("-45")).toBe(-45);
    expect(parseAmount("฿1.234,50")).toBe(1234.5);
    expect(parseAmount("12.00 DR")).toBe(-12);
    expect(parseAmount("")).toBeNull();
  });

  it("reads dates day-first or month-first, and written out", () => {
    expect(parseDate("2026-03-04", true)).toBe("2026-03-04");
    expect(parseDate("03/04/2026", true)).toBe("2026-04-03");
    expect(parseDate("03/04/2026", false)).toBe("2026-03-04");
    expect(parseDate("4 Mar 2026", true)).toBe("2026-03-04");
    expect(parseDate("Mar 4, 2026", true)).toBe("2026-03-04");
    expect(parseDate("nonsense", true)).toBeNull();
  });

  it("masks account and card numbers down to the last four digits", () => {
    expect(maskNumbers("GRAB FOOD 4412 8812 3456 7890")).toBe("GRAB FOOD ••••7890");
    expect(maskNumbers("Order 12 of 3")).toBe("Order 12 of 3");
    expect(maskNumbers("Acct 123-4-56789-0")).toBe("Acct ••••7890");
    // Dates and whole CSV rows are left alone.
    expect(maskNumbers("2026-01-05,NETFLIX,419.00\n2026-02-05,NETFLIX,419.00")).toBe(
      "2026-01-05,NETFLIX,419.00\n2026-02-05,NETFLIX,419.00",
    );
  });
});

describe("a bank statement", () => {
  const parsed = parseStatement(BANK);

  it("finds the table under the account details and reads every row", () => {
    expect(parsed.transactions).toHaveLength(9);
    expect(parsed.skipped).toBe(0);
    expect(parsed.transactions[0]).toMatchObject({ date: "2026-01-03", amount: 85000, category: "Income" });
    expect(parsed.transactions.find((t) => t.description.startsWith("GRAB"))).toMatchObject({
      amount: -320,
      category: "Eating out",
      description: "GRAB FOOD ••••7890",
    });
  });

  it("adds it up, leaves transfers out, and finds the subscription", () => {
    const summary = summarizeSpending(parsed.transactions)!;
    expect(summary.moneyIn).toBe(170000);
    // 3 x 419 + 1250.50 + 320 + 18000; the 10,000 transfer to savings is not spending.
    expect(summary.moneyOut).toBe(20827.5);
    expect(summary.byCategory[0]).toMatchObject({ category: "Housing", total: 18000 });
    expect(summary.recurring).toHaveLength(1);
    expect(summary.recurring[0]).toMatchObject({ amount: 419, cadence: "monthly", times: 3 });
    expect(summary.byMonth.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);

    const text = describeSpending(summary, ["jan-mar.csv"], parsed.skipped);
    expect(text).toContain("Money out: 20,827.50");
    expect(text).not.toMatch(/\d{6,}/);
  });

  it("reads a card export where spending is listed as positive amounts", () => {
    const card = parseStatement("Date,Merchant,Amount\n2026-03-01,SPOTIFY,5.99\n2026-03-02,UBER TRIP,12.40\n");
    expect(card.transactions.map((t) => t.amount)).toEqual([-5.99, -12.4]);
    expect(card.transactions.map((t) => t.category)).toEqual(["Subscriptions", "Transport"]);
  });

  it("returns nothing, not a guess, for a file that is not a statement", () => {
    expect(parseStatement("hello,world\nfoo,bar").transactions).toEqual([]);
    expect(summarizeSpending([])).toBeNull();
  });
});
