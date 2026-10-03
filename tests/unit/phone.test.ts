import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform/db", () => ({ prisma: {} }));
import { isE164, sayTwiml, screenTwiml, twilioSignature, validSignature } from "@/lib/integrations/phone";

describe("phone", () => {
  it("accepts only international numbers", () => {
    expect(isE164("+66812345678")).toBe(true);
    expect(isE164("0812345678")).toBe(false);
    expect(isE164("+0123")).toBe(false);
  });
  it("verifies Twilio's signature and rejects tampering", () => {
    const params = { From: "+66812345678", CallSid: "CA1" };
    const sig = twilioSignature("secret-token-1234", "https://x.test/api/hooks/phone/abc", params);
    expect(validSignature("secret-token-1234", "https://x.test/api/hooks/phone/abc", params, sig)).toBe(true);
    expect(validSignature("secret-token-1234", "https://x.test/api/hooks/phone/abc", { ...params, From: "+1" }, sig)).toBe(false);
    expect(validSignature("secret-token-1234", "https://x.test/api/hooks/phone/abc", params, null)).toBe(false);
  });
  it("escapes what is spoken so a message can't inject TwiML", () => {
    expect(sayTwiml("</Say><Dial>+1</Dial>")).not.toContain("<Dial>");
    expect(screenTwiml("Tiger", "https://x.test/h?step=after&a=1", "th-TH")).toContain('language="th-TH"');
    expect(screenTwiml("Tiger", "https://x.test/h?step=after&a=1", "en-US")).toContain("&amp;a=1");
  });
});
