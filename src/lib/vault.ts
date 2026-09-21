/**
 * The credential vault: AES-256-GCM around a JSON value, keyed by VAULT_KEY.
 *
 * Every integration secret an organisation connects - webhook endpoints and
 * signing secrets, email API keys - goes through here before it touches the
 * database and is decrypted only at the moment of use. The key never leaves
 * the environment; losing it means reconnecting every integration, which is
 * the right failure mode for a key that guards other people's credentials.
 *
 * Format: v1.<iv>.<tag>.<ciphertext>, all base64url, so a stored value is
 * recognisably encrypted and versioned for a future key rotation.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

let cachedKey: Buffer | null = null;

export function vaultConfigured(): boolean {
  return Boolean(process.env.VAULT_KEY?.trim());
}

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.VAULT_KEY?.trim();
  if (!raw) {
    throw new Error(
      "VAULT_KEY is not set. Generate one with `openssl rand -base64 32` - integrations cannot be stored without it.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("VAULT_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  cachedKey = buf;
  return buf;
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function open<T = unknown>(sealed: string): T {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("That value is not a vault ciphertext.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${VERSION}.`);
}
