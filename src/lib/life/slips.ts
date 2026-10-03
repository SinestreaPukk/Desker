/**
 * Slips, bills and statements in, ledger entries out.
 *
 * A person drops in the photos they already have (a transfer slip, a receipt,
 * a utility bill, a PDF invoice) or a bank CSV; each becomes structured
 * entries in the life context with its line items and the original file kept.
 * Nothing is scanned in the background: only files the person chose.
 * `normalizeSlip` is pure and tested; the model only reads, code decides what
 * is stored.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getProvider, type UserImage } from "@/lib/llm/provider";
import { parseModelJson } from "@/lib/work/model-json";
import { extractText } from "@/lib/rag/extract";
import { maskNumbers, parseStatement } from "@/lib/money/statement";
import { storage } from "@/lib/storage";
import * as store from "./store";

const CATEGORIES = ["food", "transport", "shopping", "bills", "home", "health", "fitness", "travel", "entertainment", "income", "transfer", "other"] as const;

type EntryIn = Parameters<typeof store.addEntry>[1];

const PROMPT = `Read this document (a bank transfer slip, receipt, utility bill or invoice; Thai or English). Reply with JSON only:
{"kind": "expense" | "income" | "bill", "payee": string, "amount": number, "currency": "THB" | string, "date": "YYYY-MM-DD", "category": one of ${CATEGORIES.join("|")}, "items": [{"name": string, "qty": number, "amount": number}]}
- A transfer the person SENT or a purchase is "expense". Money they RECEIVED is "income". A bill still to be paid is "bill" and "date" is its DUE date.
- "payee" is who was paid or who sent the money (the shop, the person, the biller). "amount" is the total, in major units.
- Leave "items" empty when the document has no line items. Convert Buddhist-era years (25xx) to Gregorian. If this is not a financial document, reply {"kind": "none"}.`;

/** Raw model output (or anything else) to a ledger entry, or null when it can't be trusted. */
export function normalizeSlip(raw: Record<string, unknown> | null, sourceRef?: string): EntryIn | null {
  if (!raw) return null;
  const kind = raw.kind;
  if (kind !== "expense" && kind !== "income" && kind !== "bill") return null;
  const amount = Number(raw.amount);
  const when = new Date(String(raw.date));
  const payee = maskNumbers(String(raw.payee ?? "")).trim().slice(0, 120);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e8 || !payee || Number.isNaN(when.getTime())) return null;
  const year = when.getFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 2) return null;
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((i) => ({ name: String((i as { name?: unknown }).name ?? "").slice(0, 120), qty: Number((i as { qty?: unknown }).qty) || 1, amountMinor: Math.round((Number((i as { amount?: unknown }).amount) || 0) * 100) }))
        .filter((i) => i.name)
        .slice(0, 50)
    : [];
  const category = (CATEGORIES as readonly string[]).includes(String(raw.category)) ? String(raw.category) : "other";
  return {
    kind,
    payee,
    amountMinor: Math.round(amount * 100),
    currency: /^[A-Z]{3}$/.test(String(raw.currency)) ? String(raw.currency) : "THB",
    category,
    occurredAt: when,
    status: kind === "bill" ? "unpaid" : undefined,
    lineItems: items.length ? items : undefined,
    sourceRef,
  };
}

const IMAGE_TYPES: Record<string, UserImage["mediaType"]> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const ext = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

export interface ImportResult {
  file: string;
  added: number;
  duplicates: number;
  error?: string;
}

async function read(organizationId: string, file: { name: string; type: string; data: Buffer }): Promise<{ raw: Record<string, unknown> | null } | null> {
  const provider = await getProvider(env.hasAnthropicKey ? "anthropic" : "openai");
  const image = IMAGE_TYPES[ext(file.name)];
  const text = image ? "" : await extractText(file.data, file.name, file.type);
  const turn = await provider.complete({
    billing: { organizationId },
    systemPrompt: PROMPT,
    messages: [{ role: "user", content: image ? "Read the attached image." : text.slice(0, 12_000), images: image ? [{ mediaType: image, data: file.data.toString("base64") }] : undefined }],
    tools: [],
    maxTokens: 600,
  });
  return { raw: parseModelJson(turn.message.content) };
}

/** Imports the files a person chose. A slip already in the ledger (same payee, amount, minute) is skipped, so re-uploading is safe. */
export async function importFiles(
  space: { organizationId: string; projectId: string },
  files: { name: string; type: string; data: Buffer }[],
): Promise<ImportResult[]> {
  const actor = { ...space, source: "user" };
  const out: ImportResult[] = [];
  for (const file of files) {
    const result: ImportResult = { file: file.name, added: 0, duplicates: 0 };
    try {
      let entries: EntryIn[] = [];
      if (ext(file.name) === ".csv") {
        entries = parseStatement(file.data.toString("utf8")).transactions.map((t) => ({
          kind: t.amount < 0 ? "expense" : "income",
          payee: maskNumbers(t.description).slice(0, 120),
          amountMinor: Math.round(Math.abs(t.amount) * 100),
          category: t.category,
          occurredAt: new Date(t.date),
          sourceKind: "csv",
        }));
      } else {
        const stored = await storage.put(`life/${space.projectId}`, file.name, file.data);
        const parsed = normalizeSlip((await read(space.organizationId, file))?.raw ?? null, stored.storageKey);
        if (!parsed) throw new Error("Couldn't find a payment, bill or invoice in this file.");
        entries = [{ ...parsed, sourceKind: IMAGE_TYPES[ext(file.name)] ? "slip" : "invoice" }];
      }
      for (const entry of entries) {
        const at = entry.occurredAt.getTime();
        const same = await prisma.lifeEntry.findFirst({
          where: { projectId: space.projectId, kind: entry.kind, payee: entry.payee, amountMinor: entry.amountMinor, occurredAt: { gte: new Date(at - 60_000), lte: new Date(at + 60_000) } },
          select: { id: true },
        });
        if (same) result.duplicates++;
        else {
          await store.addEntry(actor, entry);
          result.added++;
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Couldn't read this file.";
    }
    out.push(result);
  }
  return out;
}
