/**
 * A link to a kept screenshot that works without signing in, for apps that fetch
 * the picture themselves (LINE). Signed and short-lived: the key alone is not enough.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/platform/env";

const TTL_MS = 7 * 86_400_000;
const sign = (key: string, exp: number) => createHmac("sha256", process.env.VAULT_KEY ?? "").update(`${key}.${exp}`).digest("base64url");

export function signedShotUrl(key: string): string {
  const exp = Date.now() + TTL_MS;
  return `${env.appUrl}/api/browser/shot/public?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sign(key, exp)}`;
}

export function validShotSignature(key: string, exp: number, sig: string): boolean {
  if (!process.env.VAULT_KEY || !Number.isFinite(exp) || exp < Date.now()) return false;
  const want = Buffer.from(sign(key, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
