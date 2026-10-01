/**
 * Live bank data through Plaid: transactions, balances and interest.
 *
 * Each linked bank is one Integration row of type "bank" whose sealed secret
 * holds Plaid's access token. Nothing is copied into our database - the money
 * manager asks Plaid when it runs, and the rows go through the same
 * summarizeSpending as an uploaded CSV. Plaid only ever sends the last four
 * digits of an account, and descriptions are masked like statement rows.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { open, seal } from "@/lib/vault";
import { categorize, maskNumbers, type Transaction } from "@/lib/money/statement";

const HOSTS = { sandbox: "sandbox", development: "development", production: "production" } as const;

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
}

async function plaid<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof HOSTS;
  const response = await fetch(`https://${HOSTS[env] ?? "sandbox"}.plaid.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error_message?: string; error_code?: string };
  if (!response.ok) throw new Error(data.error_message ?? `Plaid ${path} failed (${response.status}).`);
  return data;
}

export async function createLinkToken(userId: string): Promise<string> {
  const countries = (process.env.PLAID_COUNTRY_CODES ?? "US,GB,CA").split(",").map((c) => c.trim());
  const data = await plaid<{ link_token: string }>("/link/token/create", {
    client_name: "Desker",
    language: "en",
    country_codes: countries,
    user: { client_user_id: userId },
    products: ["transactions"],
    optional_products: ["liabilities"],
  });
  return data.link_token;
}

/** Swaps Link's one-time public token for a stored connection; linking the same bank twice replaces it. */
export async function saveBank(organizationId: string, publicToken: string, institution: string) {
  const data = await plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
    public_token: publicToken,
  });
  const rows = await prisma.integration.findMany({ where: { organizationId, type: "bank" }, select: { id: true, config: true } });
  const existing = rows.find((row) => (row.config as { itemId?: string } | null)?.itemId === data.item_id);
  const fields = {
    name: institution,
    config: { account: institution, itemId: data.item_id },
    secret: seal({ accessToken: data.access_token }),
    enabled: true,
  };
  return existing
    ? prisma.integration.update({ where: { id: existing.id }, data: fields })
    : prisma.integration.create({ data: { ...fields, organizationId, type: "bank" } });
}

interface PlaidAccount {
  account_id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code: string | null };
}

interface PlaidTransaction {
  account_id: string;
  date: string;
  name: string;
  merchant_name: string | null;
  /** Plaid: positive is money out. Ours: negative is money out. */
  amount: number;
  pending: boolean;
}

export interface BankData {
  transactions: Transaction[];
  /** Plain lines for the model: balances and interest, already worked out. */
  overview: string[];
  banks: string[];
}

/** Everything the linked banks hold for a date range; null when no bank is linked. */
export async function readBanks(organizationId: string, since: string, until: string): Promise<BankData | null> {
  if (!plaidConfigured()) return null;
  const rows = await prisma.integration.findMany({
    where: { organizationId, type: "bank", enabled: true, secret: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return null;

  const result: BankData = { transactions: [], overview: [], banks: [] };
  for (const row of rows) {
    const bank = row.name;
    const { accessToken } = open<{ accessToken: string }>(row.secret!);
    try {
      const { accounts } = await plaid<{ accounts: PlaidAccount[] }>("/accounts/balance/get", { access_token: accessToken });
      const labels = new Map(accounts.map((a) => [a.account_id, `${a.name}${a.mask ? ` ••${a.mask}` : ""}`]));
      result.banks.push(bank);
      for (const a of accounts) {
        const { current, available, iso_currency_code: currency } = a.balances;
        result.overview.push(
          `${bank} - ${labels.get(a.account_id)} (${a.subtype ?? a.type}): balance ${current ?? "unknown"}${
            available != null && available !== current ? `, available ${available}` : ""
          } ${currency ?? ""}`.trim(),
        );
      }

      // ponytail: one page of 500 per bank; paginate with offset when a range needs more.
      const { transactions } = await plaid<{ transactions: PlaidTransaction[] }>("/transactions/get", {
        access_token: accessToken,
        start_date: since,
        end_date: until,
        options: { count: 500 },
      });
      let interest = 0;
      for (const t of transactions) {
        if (t.pending) continue;
        const description = maskNumbers(t.merchant_name ?? t.name);
        const amount = -t.amount;
        if (amount > 0 && /interest/i.test(description)) interest += amount;
        result.transactions.push({ date: t.date, description, amount, category: categorize(description, amount) });
      }
      if (interest > 0) result.overview.push(`${bank} - interest paid to you in this range: ${interest.toFixed(2)}`);

      // Rates on cards and loans. Not every bank or plan has them, so a refusal is not an error.
      const liabilities = await plaid<{
        liabilities: {
          credit?: { account_id: string; aprs: { apr_type: string; apr_percentage: number }[] }[] | null;
          student?: { account_id: string; interest_rate_percentage: number }[] | null;
          mortgage?: { account_id: string; interest_rate: { percentage: number | null } }[] | null;
        };
      }>("/liabilities/get", { access_token: accessToken }).catch(() => null);
      for (const c of liabilities?.liabilities.credit ?? []) {
        const apr = c.aprs.find((a) => a.apr_type === "purchase_apr") ?? c.aprs[0];
        if (apr) result.overview.push(`${bank} - ${labels.get(c.account_id)}: interest rate ${apr.apr_percentage}% APR`);
      }
      for (const s of liabilities?.liabilities.student ?? [])
        result.overview.push(`${bank} - ${labels.get(s.account_id)}: interest rate ${s.interest_rate_percentage}%`);
      for (const m of liabilities?.liabilities.mortgage ?? [])
        if (m.interest_rate.percentage != null)
          result.overview.push(`${bank} - ${labels.get(m.account_id)}: interest rate ${m.interest_rate.percentage}%`);
    } catch (error) {
      result.overview.push(`${bank}: could not be read (${error instanceof Error ? error.message : "unknown error"}). The owner may need to reconnect it.`);
    }
  }
  return result;
}
