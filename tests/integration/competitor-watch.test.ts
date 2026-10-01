/**
 * Competitor watch against a real database, Instagram faked at the network
 * edge: the first look records the account, a look a day later says what
 * changed, and an agent reaches it through social_read. Needs DATABASE_URL and VAULT_KEY.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { saveConnection } from "@/lib/integrations/oauth";
import { watchInstagram } from "@/lib/integrations/social";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;

const post = (n: number, likes: number) => ({
  caption: `Post ${n}`,
  like_count: likes,
  comments_count: 2,
  timestamp: `2026-09-${10 + n}T09:00:00+0000`,
  permalink: `https://www.instagram.com/p/${n}/`,
  media_type: "VIDEO",
});

function fakeInstagram(followers: number, media: unknown[]) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("business_discovery")) {
        return Response.json({ business_discovery: { username: "roasteryco", name: "Roastery Co", followers_count: followers, media_count: 40, media: { data: media } } });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    }),
  );
  return urls;
}

beforeAll(async () => {
  organizationId = (await prisma.organization.create({ data: { name: `Watch ${stamp}`, slug: `watch-${stamp}` } })).id;
  await saveConnection({
    organizationId,
    connectorId: "meta",
    tokens: { accessToken: "user", extra: { pages: [{ id: "page1", name: "Beans", token: "page-token", instagram: { id: "ig1", username: "beans" } }] } },
    account: "Beans + @beans",
  });
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("competitor watch", () => {
  it("records the first look, then says what changed a day later", async () => {
    const urls = fakeInstagram(1000, [post(1, 50), post(2, 80)]);
    const first = await watchInstagram(organizationId, { action: "competitor", handle: "https://www.instagram.com/roasteryco/" });
    expect(decodeURIComponent(urls[0]!)).toContain("username(roasteryco)");
    expect(urls[0]).toContain("access_token=page-token");
    expect(first).toContain("First look");
    expect(first).toContain("1,000 followers");

    // Pretend that look was yesterday.
    await prisma.socialSnapshot.updateMany({ where: { organizationId }, data: { takenAt: new Date(Date.now() - 24 * 60 * 60_000) } });
    fakeInstagram(1312, [post(3, 400), post(1, 55), post(2, 81)]);
    const second = await watchInstagram(organizationId, { action: "competitor", handle: "@roasteryco" });
    expect(second).toContain("+312 followers, 1 new post");
    expect(second).toContain("Post 3");
    expect(second).toMatch(/Best of the last 3: .*Post 3/);
    expect(await prisma.socialSnapshot.count({ where: { organizationId } })).toBe(2);
  });

  it("refuses something that isn't a username before calling Instagram", async () => {
    const urls = fakeInstagram(0, []);
    await expect(watchInstagram(organizationId, { action: "competitor", handle: "roastery co; drop" })).rejects.toThrow(/username/);
    expect(urls).toHaveLength(0);
  });
});
