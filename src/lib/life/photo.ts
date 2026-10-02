/**
 * A photo the person sends their assistants. Most are not bank slips: a
 * poster, an invitation, a letter, a product, a screenshot. One look decides
 * what it is and writes down every concrete detail (dates, places, amounts),
 * which is kept as a note in the life context so the next message ("add it to
 * my calendar", "remind me before it's due") has the picture to work from.
 * Slips and bills are handed on to the ledger instead.
 */
import "server-only";
import { env } from "@/lib/env";
import { getProvider, type UserImage } from "@/lib/llm/provider";
import { parseModelJson } from "@/lib/work/model-json";

export type PhotoKind = "slip" | "bill" | "event" | "document" | "other";

const PROMPT = `Look at the picture the person sent their personal assistant. Reply with JSON only:
{"kind": "slip" | "bill" | "event" | "document" | "other", "summary": string}
- "slip": a bank transfer slip or a shop receipt. "bill": a bill or invoice still to be paid.
- "event": a poster, invitation, ticket, booking or appointment card. "document": a letter, form, contract, screenshot of text.
- "summary": what it is, and EVERY concrete detail useful later: dates, times, places, names, amounts, deadlines, reference numbers (leave long account numbers out). Plain words, under 90 words. If you cannot tell what it is, say what you can see.`;

export interface Photo {
  kind: PhotoKind;
  summary: string;
}

export function normalizePhoto(raw: Record<string, unknown> | null): Photo | null {
  const kind = raw?.kind;
  const summary = typeof raw?.summary === "string" ? raw.summary.trim().slice(0, 700) : "";
  if (!summary) return null;
  return { kind: kind === "slip" || kind === "bill" || kind === "event" || kind === "document" ? kind : "other", summary };
}

export async function describePhoto(organizationId: string, image: UserImage): Promise<Photo | null> {
  if (!(env.hasAnthropicKey || env.hasOpenAiKey)) return null;
  const provider = await getProvider(env.hasAnthropicKey ? "anthropic" : "openai");
  const turn = await provider.complete({
    billing: { organizationId },
    systemPrompt: PROMPT,
    messages: [{ role: "user", content: "Describe this picture.", images: [image] }],
    tools: [],
    maxTokens: 400,
  });
  return normalizePhoto(parseModelJson(turn.message.content));
}

/** What to offer next, as one-tap replies. Each label is also the message sent, so it flows through the normal chat with the photo note in context. */
export function nextSteps(kind: PhotoKind): string[] {
  if (kind === "event") return ["Add to my calendar", "Remind me before", "Never mind"];
  if (kind === "document") return ["Summarise it", "Set a reminder", "Never mind"];
  return ["What is this?", "Never mind"];
}
