import { expect, it } from "vitest";
import { replyMessages } from "@/lib/messaging/line";
import { signedShotUrl, validShotSignature } from "@/lib/browser/shot-url";

process.env.VAULT_KEY = Buffer.alloc(32, 1).toString("base64");

it("turns screenshot lines into LINE pictures with signed links", () => {
  const key = "browser/p1/abc-shot.jpg";
  const out = replyMessages(`Found it.\n\n![Prices](/api/browser/shot?key=${encodeURIComponent(key)})`);
  expect(out.map((m) => m.type)).toEqual(["text", "image"]);
  const url = new URL(out[1]!.originalContentUrl as string, "https://x.test");
  expect(url.pathname).toBe("/api/browser/shot/public");
  expect(validShotSignature(key, Number(url.searchParams.get("exp")), url.searchParams.get("sig")!)).toBe(true);
  expect(validShotSignature("browser/p2/abc-shot.jpg", Number(url.searchParams.get("exp")), url.searchParams.get("sig")!)).toBe(false);
  expect(signedShotUrl(key)).toContain("sig=");
});
