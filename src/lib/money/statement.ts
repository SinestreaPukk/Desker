/**
 * Bank and card statements, added up.
 *
 * A model asked to total a statement guesses; this does the arithmetic, and
 * the money manager writes about the result. The review_spending tool hands
 * the model only the summary - categories, merchants, recurring charges -
 * and long digit runs (account and card numbers, references) are masked here
 * and at upload (lib/rag/extract.ts), so no model ever reads them.
 *
 * Pure and dependency-free: CSV in, numbers out. Every bank exports a
 * slightly different CSV, so the column detection is by header name and the
 * date and sign conventions are inferred from the whole file.
 */

export interface Transaction {
  /** yyyy-mm-dd */
  date: string;
  description: string;
  /** Negative is money out, positive is money in. */
  amount: number;
  category: string;
}

export interface ParsedStatement {
  transactions: Transaction[];
  /** Rows that had no readable date or amount. */
  skipped: number;
}

// --- CSV --------------------------------------------------------------------

/** RFC 4180-ish: quoted fields, doubled quotes, commas or semicolons. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

// --- columns ----------------------------------------------------------------

const DATE = /date|posted|time|วันที่/i;
const DESCRIPTION = /desc|detail|narrative|merchant|payee|memo|name|reference|particular|transaction|รายการ/i;
const AMOUNT = /amount|value|sum|จำนวน/i;
const DEBIT = /debit|withdraw|money out|paid out|out\b|spent|ถอน/i;
const CREDIT = /credit|deposit|money in|paid in|in\b|received|ฝาก/i;

interface Columns {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
}

function findColumns(header: string[]): Columns | null {
  const find = (pattern: RegExp, taken: number[] = []) =>
    header.findIndex((cell, index) => !taken.includes(index) && pattern.test(cell));
  const date = find(DATE);
  if (date === -1) return null;
  const debit = find(DEBIT, [date]);
  const credit = find(CREDIT, [date, debit]);
  const amount = find(AMOUNT, [date, debit, credit]);
  const description = find(DESCRIPTION, [date, debit, credit, amount]);
  if (amount === -1 && debit === -1 && credit === -1) return null;
  return { date, description, amount, debit, credit };
}

// --- values -----------------------------------------------------------------

/** "1,234.50", "-45.00", "(45.00)", "฿1.234,50", "45.00 CR" -> number, or null. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text) || /-$/.test(text) || /\bDR\b/i.test(text);
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return null;
  // European "1.234,50": the last separator is the decimal one.
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot && text.length - lastComma <= 3) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** yyyy-mm-dd, or null. `dayFirst` settles 03/04/2026. */
export function parseDate(raw: string | undefined, dayFirst: boolean): string | null {
  const text = raw?.trim() ?? "";
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return iso(+match[1]!, +match[2]!, +match[3]!);
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) {
    const [a, b, year] = [+match[1]!, +match[2]!, +match[3]!];
    return dayFirst ? iso(year, b, a) : iso(year, a, b);
  }
  match = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{2,4})/);
  if (match) return iso(+match[3]!, MONTHS[match[2]!.toLowerCase()] ?? 0, +match[1]!);
  match = text.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) return iso(+match[3]!, MONTHS[match[1]!.toLowerCase()] ?? 0, +match[2]!);
  return null;
}

/** Whether 03/04 means 3 April: any first part over 12 says yes, any second part over 12 says no. */
function inferDayFirst(values: string[]): boolean {
  for (const value of values) {
    const match = value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!match) continue;
    if (+match[1]! > 12) return true;
    if (+match[2]! > 12) return false;
  }
  return true;
}

/**
 * Account and card numbers, long references: kept to their last four digits.
 * Nine digits or more, so a date (2026-01-05) or an amount survives; spaces
 * and dashes only within a line, so a CSV's rows never run together.
 */
export function maskNumbers(text: string): string {
  return text.replace(/\d[\d \t-]{7,}\d/g, (run) => {
    const digits = run.replace(/\D/g, "");
    return digits.length >= 9 ? `••••${digits.slice(-4)}` : run;
  });
}

// --- categories -------------------------------------------------------------

// ponytail: keyword rules, English and Thai merchants; a model-assisted pass if "Other" grows large.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Income", /salary|payroll|wages|refund|interest paid|dividend|เงินเดือน/i],
  ["Transfers", /transfer|trf|promptpay|venmo|zelle|revolut|wise|paypal \*?transfer|โอน/i],
  ["Subscriptions", /netflix|spotify|youtube|disney|apple\.com|icloud|google \*|google one|prime|adobe|chatgpt|openai|anthropic|claude|notion|dropbox|canva|patreon|substack|hbo|max\.com|linkedin premium|duolingo/i],
  ["Groceries", /tesco|lotus|big c|makro|villa market|tops|gourmet|7-eleven|7 eleven|family ?mart|lawson|aldi|lidl|sainsbury|waitrose|walmart|kroger|costco|whole foods|trader joe|grocer|supermarket|market/i],
  ["Eating out", /grab ?food|foodpanda|lineman|uber ?eats|deliveroo|doordash|just eat|starbucks|cafe|coffee|restaurant|bar\b|pub\b|mcdonald|kfc|burger|pizza|sushi|bistro|kitchen/i],
  ["Transport", /grab|bolt|uber|lyft|taxi|bts|mrt|metro|rail|train|bus\b|shell|ptt|esso|caltex|bp\b|chevron|fuel|petrol|parking|toll|easy ?pass/i],
  ["Bills & utilities", /electric|pea\b|mea\b|water|pwa\b|internet|broadband|true ?move|ais\b|dtac|3bb|mobile|phone|telecom|insurance|council tax|utility/i],
  ["Housing", /rent|landlord|mortgage|condo|juristic|property|strata|hoa\b/i],
  ["Health", /pharmacy|boots|watsons|hospital|clinic|dental|doctor|gym|fitness|yoga|health/i],
  ["Travel", /airline|airways|air asia|airasia|thai airways|bangkok airways|booking\.com|agoda|airbnb|expedia|hotel|hostel|trip\.com/i],
  ["Shopping", /amazon|shopee|lazada|ikea|uniqlo|h&m|zara|central|robinson|the mall|emporium|apple store|store|shop/i],
  ["Entertainment", /cinema|major|sf cinema|steam|playstation|xbox|nintendo|ticket|concert|museum/i],
  ["Cash", /atm|cash withdrawal|ถอนเงินสด/i],
  ["Fees", /fee|charge|interest|penalty|ค่าธรรมเนียม/i],
];

export function categorize(description: string, amount: number): string {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(description)) {
      // "Refund" on a card is money back, not income; salary is only income when it comes in.
      if (category === "Income" && amount < 0) continue;
      return category;
    }
  }
  return amount > 0 ? "Money in" : "Other";
}

// --- parsing a statement ------------------------------------------------------

export function parseStatement(text: string): ParsedStatement {
  const rows = parseCsv(text);
  // Banks put a few lines of account details above the table; the header is
  // the first row whose columns we can name.
  let headerIndex = -1;
  let columns: Columns | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    columns = findColumns(rows[i]!);
    if (columns) {
      headerIndex = i;
      break;
    }
  }
  if (!columns) return { transactions: [], skipped: rows.length };

  const body = rows.slice(headerIndex + 1);
  const dayFirst = inferDayFirst(body.map((row) => row[columns!.date] ?? ""));
  const raw: { date: string; description: string; amount: number }[] = [];
  let skipped = 0;
  for (const row of body) {
    const date = parseDate(row[columns.date], dayFirst);
    let amount: number | null = null;
    if (columns.debit !== -1 || columns.credit !== -1) {
      const out = parseAmount(row[columns.debit]);
      const into = parseAmount(row[columns.credit]);
      if (out !== null || into !== null) amount = Math.abs(into ?? 0) - Math.abs(out ?? 0);
    }
    if (amount === null && columns.amount !== -1) amount = parseAmount(row[columns.amount]);
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const description =
      maskNumbers(
        (columns.description !== -1 ? row[columns.description] : row.filter((_, i) => i !== columns!.date).join(" ")) ?? "",
      ).trim() || "(no description)";
    raw.push({ date, description, amount });
  }

  // A single amount column that is all positive is a card statement listing
  // what was spent; flip it so money out is negative like everywhere else.
  const singleColumn = columns.debit === -1 && columns.credit === -1;
  if (singleColumn && raw.length > 0 && raw.every((row) => row.amount > 0)) {
    for (const row of raw) row.amount = -row.amount;
  }

  return {
    transactions: raw.map((row) => ({ ...row, category: categorize(row.description, row.amount) })),
    skipped,
  };
}

// --- summary ----------------------------------------------------------------

export interface Recurring {
  merchant: string;
  /** Typical charge. */
  amount: number;
  cadence: "weekly" | "monthly" | "yearly";
  /** Roughly what it costs a month. */
  perMonth: number;
  lastCharged: string;
  times: number;
}

export interface SpendingSummary {
  from: string;
  to: string;
  transactions: number;
  moneyIn: number;
  moneyOut: number;
  byCategory: { category: string; total: number; share: number }[];
  byMonth: { month: string; moneyIn: number; moneyOut: number }[];
  topMerchants: { merchant: string; total: number; times: number }[];
  recurring: Recurring[];
  largest: { date: string; description: string; amount: number }[];
}

/** "NETFLIX.COM 866-579 BANGKOK" and "Netflix.com" are one merchant. */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/••••\d{4}/g, "")
    .replace(/[^a-z฀-๿& ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !["pos", "purchase", "card", "payment", "debit", "visa", "mastercard", "the"].includes(word))
    .slice(0, 2)
    .join(" ");
}

const round = (value: number) => Math.round(value * 100) / 100;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Same merchant, similar amount, at a steady interval: a subscription or a bill. */
function findRecurring(out: Transaction[]): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const row of out) {
    const key = merchantKey(row.description);
    if (!key || row.category === "Transfers" || row.category === "Cash") continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const found: Recurring[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const amounts = rows.map((row) => Math.abs(row.amount));
    const typical = median(amounts);
    if (amounts.some((amount) => Math.abs(amount - typical) > typical * 0.2)) continue;
    const gaps = rows.slice(1).map((row, i) => daysBetween(rows[i]!.date, row.date));
    const gap = median(gaps);
    const cadence = gap >= 5 && gap <= 9 ? "weekly" : gap >= 25 && gap <= 35 ? "monthly" : gap >= 350 && gap <= 380 ? "yearly" : null;
    if (!cadence || gaps.some((g) => Math.abs(g - gap) > (cadence === "weekly" ? 3 : 7))) continue;
    found.push({
      merchant: rows[rows.length - 1]!.description.slice(0, 60) || key,
      amount: round(typical),
      cadence,
      perMonth: round(cadence === "weekly" ? (typical * 52) / 12 : cadence === "yearly" ? typical / 12 : typical),
      lastCharged: rows[rows.length - 1]!.date,
      times: rows.length,
    });
  }
  return found.sort((a, b) => b.perMonth - a.perMonth);
}

export function summarizeSpending(transactions: Transaction[]): SpendingSummary | null {
  if (transactions.length === 0) return null;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  // Moving money between your own accounts is neither spending nor income.
  const real = sorted.filter((row) => row.category !== "Transfers");
  const out = real.filter((row) => row.amount < 0);
  const into = real.filter((row) => row.amount > 0);
  const moneyOut = out.reduce((sum, row) => sum - row.amount, 0);
  const moneyIn = into.reduce((sum, row) => sum + row.amount, 0);

  const categories = new Map<string, number>();
  for (const row of out) categories.set(row.category, (categories.get(row.category) ?? 0) - row.amount);

  const months = new Map<string, { moneyIn: number; moneyOut: number }>();
  for (const row of real) {
    const month = row.date.slice(0, 7);
    const entry = months.get(month) ?? { moneyIn: 0, moneyOut: 0 };
    if (row.amount < 0) entry.moneyOut -= row.amount;
    else entry.moneyIn += row.amount;
    months.set(month, entry);
  }

  const merchants = new Map<string, { merchant: string; total: number; times: number }>();
  for (const row of out) {
    const key = merchantKey(row.description) || row.description;
    const entry = merchants.get(key) ?? { merchant: row.description.slice(0, 60), total: 0, times: 0 };
    entry.total -= row.amount;
    entry.times++;
    merchants.set(key, entry);
  }

  return {
    from: sorted[0]!.date,
    to: sorted[sorted.length - 1]!.date,
    transactions: sorted.length,
    moneyIn: round(moneyIn),
    moneyOut: round(moneyOut),
    byCategory: [...categories]
      .map(([category, total]) => ({ category, total: round(total), share: moneyOut ? Math.round((total / moneyOut) * 100) : 0 }))
      .sort((a, b) => b.total - a.total),
    byMonth: [...months]
      .map(([month, entry]) => ({ month, moneyIn: round(entry.moneyIn), moneyOut: round(entry.moneyOut) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topMerchants: [...merchants.values()]
      .map((entry) => ({ ...entry, total: round(entry.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    recurring: findRecurring(out),
    largest: [...out]
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5)
      .map((row) => ({ date: row.date, description: row.description.slice(0, 60), amount: round(-row.amount) })),
  };
}

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The summary as the text the model reads: figures only, already added up. */
export function describeSpending(summary: SpendingSummary, sources: string[], skipped: number): string {
  const lines = [
    `Statements: ${sources.join(", ")}. ${summary.transactions} transactions from ${summary.from} to ${summary.to}${
      skipped ? ` (${skipped} rows without a date or amount were skipped)` : ""
    }. Amounts are in the statement's own currency. Transfers between accounts are left out of the totals.`,
    `Money in: ${money(summary.moneyIn)}. Money out: ${money(summary.moneyOut)}. Net: ${money(summary.moneyIn - summary.moneyOut)}.`,
    "By month:",
    ...summary.byMonth.map((m) => `- ${m.month}: in ${money(m.moneyIn)}, out ${money(m.moneyOut)}`),
    "Spending by category:",
    ...summary.byCategory.map((c) => `- ${c.category}: ${money(c.total)} (${c.share}%)`),
    "Biggest merchants:",
    ...summary.topMerchants.map((m) => `- ${m.merchant}: ${money(m.total)} over ${m.times} payment${m.times === 1 ? "" : "s"}`),
    summary.recurring.length > 0 ? "Recurring charges (subscriptions and bills):" : "No recurring charges found.",
    ...summary.recurring.map(
      (r) => `- ${r.merchant}: ${money(r.amount)} ${r.cadence} (about ${money(r.perMonth)} a month), last ${r.lastCharged}, seen ${r.times} times`,
    ),
    "Largest single payments:",
    ...summary.largest.map((l) => `- ${l.date} ${l.description}: ${money(l.amount)}`),
    "These figures are computed exactly from the statements. Quote them; do not re-add or estimate them.",
  ];
  return lines.join("\n");
}
