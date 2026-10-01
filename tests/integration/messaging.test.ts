/**
 * Alerts end to end: a LINE chat links with its code, commands work from the
 * chat, events reach the people in a space, and the brief goes once a day.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { handleInbound } from "@/lib/messaging/inbound";
import { messageOrganization, messageUser } from "@/lib/messaging/send";
import { runDueBriefs } from "@/lib/messaging/brief";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const chatId = `U${stamp}`;
let userId: string;
let orgId: string;
const sent: { url: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "token";
  process.env.LINE_CHANNEL_SECRET = "secret";
  process.env.LINE_BOT_ID = "@desker";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (String(url).startsWith("https://api.line.me")) sent.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(String(url).includes("news.google.com") ? "<rss></rss>" : "{}", { status: 200 });
  });
  userId = (await prisma.user.create({ data: { email: `alerts-${stamp}@example.test`, passwordHash: "x", firstName: "Nok" } })).id;
  orgId = (
    await prisma.organization.create({
      data: { name: `Nok's shop ${stamp}`, slug: `alerts-${stamp}`, kind: "business", memberships: { create: { userId, role: "owner" } } },
    })
  ).id;
  await prisma.messageChannel.create({ data: { userId, kind: "line", label: "LINE (waiting)", linkCode: "AB3K7Q" } });
});

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
  vi.unstubAllGlobals();
});

describe("alerts", () => {
  it("tells a stranger how to link, then links the chat that sends the code", async () => {
    expect(await handleInbound("line", chatId, "hello")).toMatch(/open Alerts in Desker/);
    expect(await handleInbound("line", chatId, "Desker AB3K7Q")).toMatch(/^Connected/);
    const channel = await prisma.messageChannel.findFirstOrThrow({ where: { userId } });
    expect(channel.linkCode).toBeNull();
    expect(channel.target).toMatch(/^v1\./); // sealed, never the chat id in the clear
    expect(channel.target).not.toContain(chatId);
  });

  it("sends a space's event to its people, and stops when they pause from the chat", async () => {
    await messageOrganization(orgId, "approval", { title: "Needs your OK", body: "Reply to the supplier" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toMatchObject({ to: chatId });
    expect(JSON.stringify(sent[0]!.body)).toContain(`Needs your OK · Nok's shop ${stamp}`);

    expect(await handleInbound("line", chatId, "pause")).toMatch(/Paused/);
    sent.length = 0;
    await messageOrganization(orgId, "approval", { title: "Needs your OK", body: "Again" });
    expect(sent).toHaveLength(0);
    // Asked for is still sent while paused.
    expect(await messageUser(userId, { title: "Test", body: "x" }, { force: true })).toBe(1);
    await handleInbound("line", chatId, "resume");
  });

  it("leaves out events the person turned off", async () => {
    await messageOrganization(orgId, "done", { title: "Task done", body: "x" });
    expect(sent).toHaveLength(0);
  });

  it("answers 'brief' in the chat", async () => {
    expect(await handleInbound("line", chatId, "brief")).toMatch(/^Good morning, Nok\./);
  });

  it("sends the morning brief once when its time comes round", async () => {
    const now = new Date();
    const hhmm = now.toISOString().slice(11, 16);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const prefs = { ...(user.alertPrefs as object), timeZone: "UTC", brief: { on: true, time: hhmm, days: [0, 1, 2, 3, 4, 5, 6], calendar: false, waiting: true, recap: true, news: false } };
    await prisma.user.update({ where: { id: userId }, data: { alertPrefs: prefs, lastBriefAt: null } });

    await runDueBriefs(new Date(now.getTime() + 60_000));
    expect(sent.filter((s) => s.body.to === chatId)).toHaveLength(1);
    await runDueBriefs(new Date(now.getTime() + 120_000));
    expect(sent.filter((s) => s.body.to === chatId)).toHaveLength(1);
  });
});
