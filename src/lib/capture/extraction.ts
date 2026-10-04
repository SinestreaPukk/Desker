import "server-only";
import { getProvider } from "@/lib/llm/provider";
import { env } from "@/lib/platform/env";
import { parseModelJson } from "@/lib/work/model-json";
import type { CaptureClassification, BillExtractionData, EventExtractionData, TaskExtractionData } from "./types";

export interface ExtractionOutput {
  classification: CaptureClassification;
  confidence: number;
  headline: string;
  billData?: BillExtractionData;
  eventData?: EventExtractionData;
  taskData?: TaskExtractionData;
  noteText?: string;
  uncertainFields: string[];
  altClassification?: CaptureClassification;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intake classifier for a personal assistant.
Analyze the input text or file summary and classify into one of:
- "bill": a bill, invoice, receipt, payment slip with amount and payee.
- "event": calendar event, dinner, meeting, appointment, trip with time or date.
- "task": a to-do item, errand, obligation, or action to take.
- "note": a fact, routine, contact detail, or memory to save.
- "question": a direct question asking for information or opinion.
- "vault_file": a generic document or file to keep.

For bills, extract:
- payee: name of company or person (e.g. MEA การไฟฟ้านครหลวง, AIS, True, Landlord)
- amount: number in major currency units (e.g. 1240.50)
- currency: default "THB" unless specified
- dueDate: YYYY-MM-DD or null
- referenceNumber: string or null
- lineItems: array of { description, amount } or null

For events, extract:
- title: event name
- startsAt: ISO 8601 local date/time or date
- location: string or null

For tasks, extract:
- title: task description
- dueAt: ISO date or null

Assess confidence (0.0 to 1.0). If any critical field (e.g. amount or due date on a bill) is unclear or missing, add it to uncertainFields.
If the input could be two things (e.g. "Friday dinner with Nok" could be an event or a note), provide altClassification.

Reply with JSON only:
{
  "classification": "bill" | "event" | "task" | "note" | "question" | "vault_file",
  "confidence": number,
  "headline": string,
  "billData": { "payee": string, "amount": number, "currency": string, "dueDate": string | null, "referenceNumber": string | null, "lineItems": [] } | null,
  "eventData": { "title": string, "startsAt": string, "location": string | null } | null,
  "taskData": { "title": string, "dueAt": string | null } | null,
  "noteText": string | null,
  "uncertainFields": string[],
  "altClassification": string | null
}`;

/** Rule-based parser for tests and fallback */
export function extractRuleBased(text: string): ExtractionOutput {
  const uncertainFields: string[] = [];

  // 1. Bill or Invoice detection
  const isBill = /(?:\b(bill|invoice|receipt|due date|baht|thb)\b)|(?:ใบแจ้งหนี้|ใบเสร็จ|ยอดเงิน|ชำระ|บาท|ค่าน้ำ|ค่าไฟ)/i.test(text);
  const amountMatch = text.match(/(?:฿|thb|baht|บาท|amount|total|ยอดเงิน)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\s*(?:baht|thb|บาท)?/i);

  if (isBill && amountMatch) {
    const rawNum = amountMatch[1]!.replace(/,/g, "");
    const amountMajor = parseFloat(rawNum);
    const amountMinor = Math.round(amountMajor * 100);

    // Extract payee
    let payee = "Bill";
    if (/การไฟฟ้านครหลวง|mea|electricity/i.test(text)) payee = "MEA Electricity";
    else if (/การประปา|mwa|water/i.test(text)) payee = "MWA Water";
    else if (/ais/i.test(text)) payee = "AIS";
    else if (/true/i.test(text)) payee = "True";
    else {
      const payeeCandidate = text.match(/(?:from|to|payee|ผู้รับเงิน|บริษัท|จ่าย)\s*([A-Za-z0-9\u0E00-\u0E7F\s]{2,30})/i);
      if (payeeCandidate) payee = payeeCandidate[1]!.trim();
      else uncertainFields.push("payee");
    }

    // Extract due date
    let dueDate: string | undefined;
    const dueMatch = text.match(/(?:due(?:\s+date)?|กำหนดชำระ|ภายในวันที่)\s*[:=]?\s*([0-9]{1,2}[\s/-][0-9]{1,2}[\s/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s*(?:[0-9]{2,4})?)/i);
    if (dueMatch) {
      dueDate = dueMatch[1]!.trim();
    } else {
      uncertainFields.push("dueDate");
    }

    // Reference number
    const refMatch = text.match(/(?:ref(?:erence)?(?:\s*no|\s*#)?|เลขที่อ้างอิง|บาร์โค้ด)\s*[:=]?\s*([A-Za-z0-9-]{5,30})/i);
    const referenceNumber = refMatch ? refMatch[1]!.trim() : undefined;

    const confidence = uncertainFields.length === 0 ? 0.95 : uncertainFields.length === 1 ? 0.8 : 0.65;

    return {
      classification: "bill",
      confidence,
      headline: `${payee} bill: ${amountMajor.toLocaleString()} THB`,
      billData: {
        payee,
        amountMajor,
        amountMinor,
        currency: "THB",
        dueDate,
        referenceNumber,
      },
      uncertainFields,
    };
  }

  // 2. Event detection (e.g. "Friday dinner with Nok at 19:00")
  const isEvent = /\b(dinner|lunch|meeting|flight|appointment|party|conference|นัด|กินข้าว|ประชุม)\b/i.test(text);
  const hasTime = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|at\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|วันศุกร์|วันจันทร์|พรุ่งนี้)\b/i.test(text);

  if (isEvent && hasTime) {
    const startsAt = new Date().toISOString();
    return {
      classification: "event",
      confidence: 0.85,
      headline: text.trim(),
      eventData: {
        title: text.trim(),
        startsAt,
      },
      uncertainFields: [],
      altClassification: "note", // Ambiguity: could be an event or a note
    };
  }

  // 3. Task detection
  const isTask = /\b(todo|to-do|task|remember to|need to|must|have to|อย่าลืม|ต้องทำ|งาน)\b/i.test(text);
  if (isTask) {
    return {
      classification: "task",
      confidence: 0.85,
      headline: text.replace(/^(todo|task|remember to|need to|must)\s*[:\-]?\s*/i, "").trim(),
      taskData: {
        title: text.trim(),
      },
      uncertainFields: [],
    };
  }

  // 4. Default: Note
  return {
    classification: "note",
    confidence: 0.9,
    headline: text.trim(),
    noteText: text.trim(),
    uncertainFields: [],
  };
}

export async function extractAndClassify(
  text: string,
  organizationId?: string,
): Promise<ExtractionOutput> {
  const fallback = extractRuleBased(text);
  if (!organizationId || (!env.hasAnthropicKey && !env.hasOpenAiKey)) {
    return fallback;
  }

  try {
    const provider = await getProvider(env.hasAnthropicKey ? "anthropic" : "openai");
    const completion = await provider.complete({
      billing: { organizationId },
      systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
      tools: [],
      maxTokens: 500,
    });

    const parsed = parseModelJson(completion.message.content) as Record<string, unknown> | null;
    if (!parsed || typeof parsed.classification !== "string") {
      return fallback;
    }

    const classification = parsed.classification as CaptureClassification;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.8;
    const headline = typeof parsed.headline === "string" ? parsed.headline : text.slice(0, 80);
    const uncertainFields = Array.isArray(parsed.uncertainFields)
      ? (parsed.uncertainFields as string[])
      : [];
    const altClassification = typeof parsed.altClassification === "string"
      ? (parsed.altClassification as CaptureClassification)
      : undefined;

    let billData: BillExtractionData | undefined;
    if (classification === "bill" && parsed.billData && typeof parsed.billData === "object") {
      const b = parsed.billData as Record<string, unknown>;
      const amountMajor = typeof b.amount === "number" ? b.amount : 0;
      billData = {
        payee: String(b.payee || "Bill"),
        amountMajor,
        amountMinor: Math.round(amountMajor * 100),
        currency: String(b.currency || "THB"),
        dueDate: typeof b.dueDate === "string" ? b.dueDate : undefined,
        referenceNumber: typeof b.referenceNumber === "string" ? b.referenceNumber : undefined,
        lineItems: Array.isArray(b.lineItems) ? (b.lineItems as Array<{ description: string; amountMinor: number }>) : undefined,
      };
    }

    let eventData: EventExtractionData | undefined;
    if (classification === "event" && parsed.eventData && typeof parsed.eventData === "object") {
      const e = parsed.eventData as Record<string, unknown>;
      eventData = {
        title: String(e.title || headline),
        startsAt: String(e.startsAt || new Date().toISOString()),
        location: typeof e.location === "string" ? e.location : undefined,
      };
    }

    let taskData: TaskExtractionData | undefined;
    if (classification === "task" && parsed.taskData && typeof parsed.taskData === "object") {
      const t = parsed.taskData as Record<string, unknown>;
      taskData = {
        title: String(t.title || headline),
        dueAt: typeof t.dueAt === "string" ? t.dueAt : undefined,
      };
    }

    return {
      classification,
      confidence,
      headline,
      billData: billData ?? fallback.billData,
      eventData: eventData ?? fallback.eventData,
      taskData: taskData ?? fallback.taskData,
      noteText: typeof parsed.noteText === "string" ? parsed.noteText : text,
      uncertainFields,
      altClassification: altClassification ?? fallback.altClassification,
    };
  } catch (error) {
    console.warn("[capture] model extraction failed, using rule-based", error);
    return fallback;
  }
}
