import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { briefCron, DEFAULT_PREFS, LINK_CODE, parseCommand, readPrefs, webhookAllowed } from "@/lib/messaging/prefs";
import { hmacMatches } from "@/lib/messaging/verify";

vi.mock("@/lib/platform/db", () => ({ prisma: {} }));
const { parseNewsRss } = await import("@/lib/messaging/brief");
const { plainText } = await import("@/lib/messaging/send");

describe("alert settings", () => {
  it("fills in anything an old saved row is missing, and survives junk", () => {
    const prefs = readPrefs({ paused: true, events: { done: true } });
    expect(prefs.paused).toBe(true);
    expect(prefs.events).toMatchObject({ done: true, approval: true });
    expect(prefs.brief.time).toBe("07:30");
    expect(readPrefs("nonsense")).toEqual(DEFAULT_PREFS);
    expect(readPrefs({ brief: { time: "25:99" } })).toEqual(DEFAULT_PREFS);
  });

  it("turns the brief's time and days into a cron, or none when it is off", () => {
    expect(briefCron({ ...DEFAULT_PREFS.brief, time: "06:45", days: [5, 1, 3] })).toBe("45 6 * * 1,3,5");
    expect(briefCron({ ...DEFAULT_PREFS.brief, on: false })).toBeNull();
    expect(briefCron({ ...DEFAULT_PREFS.brief, days: [] })).toBeNull();
  });

  it("reads commands in English and Thai, and nothing else", () => {
    expect(parseCommand("Brief")).toBe("brief");
    expect(parseCommand("/news")).toBe("news");
    expect(parseCommand("ข่าว")).toBe("news");
    expect(parseCommand("หยุด")).toBe("pause");
    expect(parseCommand("resume")).toBe("resume");
    expect(parseCommand("brief me on the budget")).toBeNull();
  });

  it("finds a link code but never one with 0, O, 1 or I in it", () => {
    expect("DESKER AB3K7Q".replace(/DESKER/g, " ").match(LINK_CODE)?.[1]).toBe("AB3K7Q");
    expect("AB0K7Q".match(LINK_CODE)).toBeNull();
  });

  it("only posts to the webhook hosts each app really uses", () => {
    expect(webhookAllowed("slack", "https://hooks.slack.com/services/T/B/x")).toBe(true);
    expect(webhookAllowed("slack", "http://hooks.slack.com/services/T/B/x")).toBe(false);
    expect(webhookAllowed("slack", "https://hooks.slack.com.evil.example/x")).toBe(false);
    expect(webhookAllowed("discord", "https://discord.com/api/webhooks/1/abc")).toBe(true);
    expect(webhookAllowed("teams", "https://prod-12.westus.logic.azure.com/workflows/x")).toBe(true);
    expect(webhookAllowed("teams", "https://169.254.169.254/latest")).toBe(false);
    expect(webhookAllowed("line", "https://hooks.slack.com/services/x")).toBe(false);
  });
});

describe("chat platform signatures", () => {
  it("accepts LINE's and WhatsApp's own signature and nothing else", () => {
    const body = '{"events":[]}';
    const line = createHmac("sha256", "s3cret").update(body).digest("base64");
    expect(hmacMatches(body, "s3cret", line, "base64")).toBe(true);
    expect(hmacMatches(body, "other", line, "base64")).toBe(false);
    expect(hmacMatches(body, "", line, "base64")).toBe(false);
    const meta = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(hmacMatches(body, "s3cret", meta, "hex", "sha256=")).toBe(true);
    expect(hmacMatches(body, "s3cret", null, "hex", "sha256=")).toBe(false);
  });
});

describe("the brief's news", () => {
  it("reads Google News items and moves the source out of the title", () => {
    const xml = `<rss><channel><item><title>Rates held steady - Bangkok Post</title><link>https://news.google.com/a</link><source url="x">Bangkok Post</source></item>
      <item><title><![CDATA[AI &amp; jobs]]></title><link>https://news.google.com/b</link></item><item><title></title></item></channel></rss>`;
    expect(parseNewsRss(xml)).toEqual([
      { title: "Rates held steady", source: "Bangkok Post", url: "https://news.google.com/a" },
      { title: "AI & jobs", source: "", url: "https://news.google.com/b" },
    ]);
  });

  it("keeps a message inside a chat app's length limit", () => {
    const text = plainText({ title: "T", body: "x".repeat(5000) }, 100);
    expect(text).toHaveLength(100);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("overnight reports in the brief", () => {
  it("shows the start of a finished task's report, flattened and short", async () => {
    const { reportOf } = await import("@/lib/messaging/brief");
    expect(reportOf({ summary: "## Report\n**Roastery Co**: +312 followers\n\n- Trending: reels" })).toBe("\n  Report Roastery Co: +312 followers - Trending: reels");
    expect(reportOf({ summary: "x".repeat(600) })).toHaveLength(3 + 100);
    expect(reportOf(null)).toBe("");
  });
});
