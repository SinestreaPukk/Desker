import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

describe("vault", () => {
  const original = process.env.VAULT_KEY;
  beforeEach(() => {
    process.env.VAULT_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env.VAULT_KEY = original;
  });

  it("seals and opens a value, and the ciphertext is not the plaintext", async () => {
    const { seal, open, isSealed } = await import("@/lib/vault");
    const secret = { url: "https://hooks.example/abc", secret: "s3cret" };
    const sealed = seal(secret);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("s3cret");
    expect(sealed).not.toContain("hooks.example");
    expect(open(sealed)).toEqual(secret);
    // Fresh iv every time.
    expect(seal(secret)).not.toBe(sealed);
  });

  it("refuses a tampered ciphertext", async () => {
    const { seal, open } = await import("@/lib/vault");
    const sealed = seal({ apiKey: "re_123" });
    const [v, iv, tag, ct] = sealed.split(".");
    const flipped = `${v}.${iv}.${tag}.${ct!.slice(0, -2)}AA`;
    expect(() => open(flipped)).toThrow();
  });
});

describe("backfill seal format", () => {
  it("what the backfill script seals, the app can open", async () => {
    process.env.VAULT_KEY = randomBytes(32).toString("base64");
    const { open } = await import("@/lib/vault");
    // The script is plain ESM with a local seal(); exercise the same algorithm here.
    const { createCipheriv } = await import("node:crypto");
    const key = Buffer.from(process.env.VAULT_KEY, "base64");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify({ apiKey: "re_x" }), "utf8")), cipher.final()]);
    const sealed = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
    expect(open(sealed)).toEqual({ apiKey: "re_x" });
  });
});
