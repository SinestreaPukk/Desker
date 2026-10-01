/** Webhook signatures from the chat platforms, checked against the raw body. */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function sameSecret(given: string | null, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** LINE: base64 HMAC-SHA256 of the body. WhatsApp: "sha256=" + hex. */
export function hmacMatches(body: string, secret: string, given: string | null, encoding: "base64" | "hex", prefix = ""): boolean {
  if (!secret) return false;
  return sameSecret(given, prefix + createHmac("sha256", secret).update(body).digest(encoding));
}
