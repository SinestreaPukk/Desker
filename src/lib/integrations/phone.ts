/**
 * Telephony through Twilio: texts, calls and call screening on a number the
 * person owns. They paste an Account SID, Auth Token and number once; the
 * token is sealed in the vault and opened only here.
 *
 * Outbound texts and calls are `external` and wait for approval. Screening is
 * inbound: Twilio calls our webhook, the caller says who they are and why,
 * and the person gets that as a message. Nothing is recorded as audio; only
 * the transcript Twilio returns is kept (as a note in the life context).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/platform/db";
import { open } from "@/lib/auth/vault";
import type { DeliveryResult } from "@/lib/work/integrations";

export interface PhoneAccess {
  integrationId: string;
  organizationId: string;
  accountSid: string;
  authToken: string;
  /** The Twilio number, E.164. */
  from: string;
  /** Screening language, a Twilio speech code: en-US or th-TH. */
  language: string;
}

const API = "https://api.twilio.com/2010-04-01/Accounts";
const E164 = /^\+[1-9]\d{6,14}$/;
export const isE164 = (value: string) => E164.test(value);

function open_(row: { id: string; organizationId: string; secret: string | null; config: unknown }): PhoneAccess | null {
  if (!row.secret) return null;
  const s = open<{ accountSid: string; authToken: string; from: string }>(row.secret);
  const language = ((row.config as Record<string, string> | null) ?? {}).language;
  return { integrationId: row.id, organizationId: row.organizationId, ...s, language: language === "th-TH" ? "th-TH" : "en-US" };
}

export async function phoneAccess(organizationId: string): Promise<PhoneAccess | null> {
  const row = await prisma.integration.findFirst({ where: { organizationId, type: "phone", enabled: true }, orderBy: { createdAt: "asc" } });
  return row ? open_(row) : null;
}

export async function phoneAccessById(integrationId: string): Promise<PhoneAccess | null> {
  const row = await prisma.integration.findFirst({ where: { id: integrationId, type: "phone", enabled: true } });
  return row ? open_(row) : null;
}

async function twilio(access: PhoneAccess, path: string, init: { method?: string; form?: Record<string, string> } = {}) {
  const response = await fetch(`${API}/${access.accountSid}/${path}`, {
    method: init.method ?? (init.form ? "POST" : "GET"),
    headers: {
      authorization: `Basic ${Buffer.from(`${access.accountSid}:${access.authToken}`).toString("base64")}`,
      ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

const fail = (status: number, data: Record<string, unknown>): DeliveryResult => ({ ok: false, status, detail: `Twilio answered: ${String(data.message ?? `status ${status}`).slice(0, 200)}` });

export async function sendSms(access: PhoneAccess, to: string, body: string): Promise<DeliveryResult> {
  const { ok, status, data } = await twilio(access, "Messages.json", { form: { From: access.from, To: to, Body: body.slice(0, 1500) } });
  return ok ? { ok, status, detail: `Texted ${to}` } : fail(status, data);
}

/** A call that reads a message aloud, then hangs up. One-way: a reminder, a confirmation, a heads-up. */
export async function placeCall(access: PhoneAccess, to: string, message: string): Promise<DeliveryResult> {
  const { ok, status, data } = await twilio(access, "Calls.json", {
    form: { From: access.from, To: to, Twiml: sayTwiml(message, access.language) },
  });
  return ok ? { ok, status, detail: `Called ${to}` } : fail(status, data);
}

export interface Text {
  from: string;
  at: string;
  body: string;
}

/** The latest texts the number received. */
export async function recentTexts(access: PhoneAccess, limit = 15): Promise<Text[]> {
  const { ok, status, data } = await twilio(access, `Messages.json?To=${encodeURIComponent(access.from)}&PageSize=${limit}`);
  if (!ok) throw new Error(fail(status, data).detail);
  return ((data.messages as Array<Record<string, string>> | undefined) ?? []).map((m) => ({ from: m.from ?? "", at: m.date_sent ?? "", body: (m.body ?? "").slice(0, 500) }));
}

// --- TwiML and webhook verification (pure) ------------------------------------

const esc = (text: string) => text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const voice = (language: string) => (language === "th-TH" ? ' language="th-TH"' : "");

export function sayTwiml(message: string, language = "en-US"): string {
  return `<Response><Say${voice(language)}>${esc(message.slice(0, 600))}</Say></Response>`;
}

const GREETING = {
  "en-US": (name: string) => `Hi, you've reached ${name}'s assistant. Please say your name and why you're calling, after the beep.`,
  "th-TH": (name: string) => `สวัสดีค่ะ นี่คือผู้ช่วยของคุณ${name} กรุณาบอกชื่อและเหตุผลที่โทรมา หลังเสียงสัญญาณค่ะ`,
} as const;
const THANKS = { "en-US": "Thank you. I'll pass that on. Goodbye.", "th-TH": "ขอบคุณค่ะ จะแจ้งให้ทราบค่ะ สวัสดีค่ะ" } as const;

/** Step one of a screened call: ask who is calling. `action` is where Twilio posts the speech. */
export function screenTwiml(name: string, action: string, language: string): string {
  const l = language === "th-TH" ? "th-TH" : "en-US";
  return `<Response><Gather input="speech" action="${esc(action)}" method="POST" speechTimeout="auto" timeout="6"${voice(l)}><Say${voice(l)}>${esc(GREETING[l](name))}</Say></Gather><Say${voice(l)}>${esc(THANKS[l])}</Say></Response>`;
}

export function thanksTwiml(language: string): string {
  const l = language === "th-TH" ? "th-TH" : "en-US";
  return `<Response><Say${voice(l)}>${esc(THANKS[l])}</Say><Hangup/></Response>`;
}

/** Twilio's signature: base64 HMAC-SHA1 over the full URL plus each POST parameter, sorted, name then value. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function validSignature(authToken: string, url: string, params: Record<string, string>, header: string | null): boolean {
  if (!header) return false;
  const a = Buffer.from(twilioSignature(authToken, url, params));
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
