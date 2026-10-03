import { describe, expect, it } from "vitest";
import { looksAutomated, MIN_FILL_MS } from "@/lib/auth/bot-check";
import { scrubDeep, scrubText } from "@/lib/platform/scrub";

describe("bot checks on the public forms", () => {
  const now = 1_800_000_000_000;
  it("lets a person through", () => {
    expect(looksAutomated({ website: "", startedAt: now - 8000 }, now)).toBe(false);
  });
  it("stops a filled hidden field, a form sent too fast, and one with no start time", () => {
    expect(looksAutomated({ website: "https://spam.example", startedAt: now - 8000 }, now)).toBe(true);
    expect(looksAutomated({ website: "", startedAt: now - (MIN_FILL_MS - 200) }, now)).toBe(true);
    expect(looksAutomated({ email: "a@b.co" }, now)).toBe(true);
    expect(looksAutomated({ startedAt: now + 5000 }, now)).toBe(true);
  });
});

describe("secrets never reach error monitoring", () => {
  it("redacts reset tokens and OAuth codes in addresses, and keeps the rest", () => {
    expect(scrubText("https://desker.dev/reset-password?token=abc123def456&from=email")).toBe(
      "https://desker.dev/reset-password?token=[redacted]&from=email",
    );
    expect(scrubText("/api/integrations/oauth/callback/x?state=s1&code=c2")).toBe(
      "/api/integrations/oauth/callback/x?state=[redacted]&code=[redacted]",
    );
  });
  it("redacts keys, bearer tokens and database URLs in error text", () => {
    const text = scrubText(
      "failed with Bearer abcdefghijkl, key sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV, whsec_ABCDEFGHIJ, postgresql://u:p@db.neon.tech/x",
    );
    expect(text).not.toMatch(/abcdefghijkl|ABCDEFGHIJKLMNOP|whsec_A|u:p@/);
  });
  it("redacts sensitive keys anywhere in a report", () => {
    const report = scrubDeep({ request: { headers: { Authorization: "Basic x", accept: "json" }, url: "/x?password=hunter2" } });
    expect(report.request.headers.Authorization).toBe("[redacted]");
    expect(report.request.headers.accept).toBe("json");
    expect(report.request.url).toBe("/x?password=[redacted]");
  });
});
