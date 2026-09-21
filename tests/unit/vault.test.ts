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
