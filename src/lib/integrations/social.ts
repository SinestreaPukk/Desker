/**
 * Social networks, directly: LinkedIn, Facebook Pages, Instagram, X and
 * Threads. Posting, editing and deleting arrive here only after the approval
 * gate, and each network is held to what its API really allows - Instagram
 * posts can't be edited, X posts can't be edited, LinkedIn won't let an app
 * read a member's posts - so an agent is told plainly instead of trying.
 *
 * Posts Desker publishes are recorded on their draft (metadata.external), so
 * "the posts Desker made" can be listed and managed even where a network
 * won't let an app read them back.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { connectorAccess, META_GRAPH, THREADS_GRAPH } from "./oauth";
import type { DeliveryResult } from "@/lib/work/integrations";

export const SOCIAL_PLATFORMS = ["linkedin", "facebook", "instagram", "x", "threads"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  threads: "Threads",
};

/** The connector each platform is reached through. */
export const PLATFORM_CONNECTOR: Record<SocialPlatform, string> = {
  linkedin: "linkedin",
  facebook: "meta",
  instagram: "meta",
  x: "x",
  threads: "threads",
};

/** The longest post each accepts, checked before anything is queued. */
export const PLATFORM_LIMIT: Record<SocialPlatform, number> = {
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  x: 280,
  threads: 500,
};

/** "Twitter", "IG", "LinkedIn" - however a draft names it; null when it isn't one of these. */
export function platformOf(value: string | null | undefined): SocialPlatform | null {
  const name = (value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<string, SocialPlatform> = {
    linkedin: "linkedin",
    facebook: "facebook",
    fb: "facebook",
    facebookpage: "facebook",
    instagram: "instagram",
    ig: "instagram",
    insta: "instagram",
    x: "x",
    twitter: "x",
    xtwitter: "x",
    threads: "threads",
  };
  return aliases[name] ?? null;
}

/** What each network lets Desker do after posting. */
export const CAN_EDIT: Record<SocialPlatform, boolean> = { linkedin: true, facebook: true, instagram: false, x: false, threads: false };
export const CAN_DELETE: Record<SocialPlatform, boolean> = { linkedin: true, facebook: true, instagram: false, x: true, threads: false };

export interface PublishResult extends DeliveryResult {
  externalId?: string;
  url?: string;
}

interface MetaPage {
  id: string;
  name: string;
  token: string;
  instagram: { id: string; username: string } | null;
}

async function request(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", ...init.headers } });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { message: text.slice(0, 300) };
  }
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

function problem(name: string, result: { status: number; data: Record<string, unknown> }): string {
  const error = result.data.error as { message?: string } | string | undefined;
  const detail =
    (typeof error === "string" ? error : error?.message) ??
    (result.data.detail as string | undefined) ??
    (result.data.message as string | undefined) ??
    ((result.data.errors as Array<{ message?: string }> | undefined)?.[0]?.message) ??
    `HTTP ${result.status}`;
  if (result.status === 401) return `${name} refused the connection (it may have expired): reconnect it under Integrations.`;
  return `${name} said: ${detail}`;
}

const fail = (status: number, detail: string): PublishResult => ({ ok: false, status, detail });

async function access(organizationId: string, platform: SocialPlatform) {
  return connectorAccess(organizationId, PLATFORM_CONNECTOR[platform]);
}

export async function socialConnected(organizationId: string, platform: SocialPlatform): Promise<boolean> {
  return Boolean(await access(organizationId, platform));
}

function metaPage(extra: Record<string, unknown>, platform: SocialPlatform, account?: string | null): MetaPage | null {
  const pages = (extra.pages as MetaPage[] | undefined) ?? [];
  const wanted = account?.trim().toLowerCase().replace(/^@/, "");
  const usable = platform === "instagram" ? pages.filter((page) => page.instagram) : pages;
  return (
    (wanted
      ? usable.find(
          (page) =>
            page.id === wanted ||
            page.name.toLowerCase() === wanted ||
            page.instagram?.username.toLowerCase() === wanted ||
            page.instagram?.id === wanted,
        )
      : null) ??
    usable[0] ??
    null
  );
}

/** A Facebook post id is "<page id>_<post id>": the page's token is the one that can change it. */
function pageForPost(extra: Record<string, unknown>, postId: string): MetaPage | null {
  const pages = (extra.pages as MetaPage[] | undefined) ?? [];
  return pages.find((page) => postId.startsWith(`${page.id}_`)) ?? pages[0] ?? null;
}

// --- LinkedIn -------------------------------------------------------------------

const LINKEDIN = "https://api.linkedin.com/rest";

function linkedinHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    // LinkedIn retires versions after a year; override with LINKEDIN_API_VERSION when this one goes.
    "LinkedIn-Version": process.env.LINKEDIN_API_VERSION?.trim() || "202608",
    "X-Restli-Protocol-Version": "2.0.0",
    "content-type": "application/json",
  };
}

/** LinkedIn's "little text": these characters mean markup unless escaped. */
export function linkedinText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, "\\$&");
}

// --- publishing -------------------------------------------------------------------

/** Posts one approved draft. */
export async function publishSocial(
  organizationId: string,
  platform: SocialPlatform,
  post: { text: string; imageUrl?: string | null; account?: string | null },
): Promise<PublishResult> {
  const name = PLATFORM_NAMES[platform];
  const conn = await access(organizationId, platform);
  if (!conn) return fail(0, `${name} is not connected.`);
  if (post.text.length > PLATFORM_LIMIT[platform]) {
    return fail(0, `${name} allows ${PLATFORM_LIMIT[platform]} characters; this post has ${post.text.length}.`);
  }
  try {
    switch (platform) {
      case "linkedin": {
        const author = String(conn.extra.personId ?? "");
        if (!author) return fail(0, "LinkedIn didn't say who you are: reconnect it under Integrations.");
        const r = await request(`${LINKEDIN}/posts`, {
          method: "POST",
          headers: linkedinHeaders(conn.accessToken),
          body: JSON.stringify({
            author: `urn:li:person:${author}`,
            commentary: linkedinText(post.text),
            visibility: "PUBLIC",
            distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false,
          }),
        });
        if (!r.ok) return fail(r.status, problem(name, r));
        const id = r.headers.get("x-restli-id") ?? "";
        return { ok: true, status: r.status, detail: `Posted to LinkedIn`, externalId: id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
      }
      case "facebook": {
        const page = metaPage(conn.extra, platform, post.account);
        if (!page) return fail(0, "No Facebook Page is connected: reconnect and pick a Page.");
        const form = new URLSearchParams(
          post.imageUrl
            ? { url: post.imageUrl, caption: post.text, access_token: page.token }
            : { message: post.text, access_token: page.token },
        );
        const r = await request(`${META_GRAPH}/${page.id}/${post.imageUrl ? "photos" : "feed"}`, { method: "POST", body: form });
        if (!r.ok) return fail(r.status, problem(name, r));
        const id = String(r.data.post_id ?? r.data.id ?? "");
        return { ok: true, status: r.status, detail: `Posted to ${page.name} on Facebook`, externalId: id, url: id ? `https://www.facebook.com/${id}` : undefined };
      }
      case "instagram": {
        const page = metaPage(conn.extra, platform, post.account);
        if (!page?.instagram) return fail(0, "No Instagram business account is linked to your connected Pages.");
        if (!post.imageUrl) return fail(0, "Instagram needs an image: give the post an image address (image_url).");
        const media = await request(`${META_GRAPH}/${page.instagram.id}/media`, {
          method: "POST",
          body: new URLSearchParams({ image_url: post.imageUrl, caption: post.text, access_token: page.token }),
        });
        if (!media.ok) return fail(media.status, problem(name, media));
        const published = await request(`${META_GRAPH}/${page.instagram.id}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: String(media.data.id), access_token: page.token }),
        });
        if (!published.ok) return fail(published.status, problem(name, published));
        const id = String(published.data.id ?? "");
        const link = await request(`${META_GRAPH}/${id}?${new URLSearchParams({ fields: "permalink", access_token: page.token })}`);
        return {
          ok: true,
          status: published.status,
          detail: `Posted to @${page.instagram.username} on Instagram`,
          externalId: id,
          url: typeof link.data.permalink === "string" ? link.data.permalink : undefined,
        };
      }
      case "x": {
        const r = await request("https://api.x.com/2/tweets", {
          method: "POST",
          headers: { authorization: `Bearer ${conn.accessToken}`, "content-type": "application/json" },
          body: JSON.stringify({ text: post.text }),
        });
        if (!r.ok) return fail(r.status, problem(name, r));
        const id = String((r.data.data as { id?: string } | undefined)?.id ?? "");
        return { ok: true, status: r.status, detail: `Posted to ${conn.account} on X`, externalId: id, url: id ? `https://x.com/i/web/status/${id}` : undefined };
      }
      case "threads": {
        const userId = String(conn.extra.userId ?? "me");
        const container = await request(`${THREADS_GRAPH}/${userId}/threads`, {
          method: "POST",
          body: new URLSearchParams({
            ...(post.imageUrl ? { media_type: "IMAGE", image_url: post.imageUrl } : { media_type: "TEXT" }),
            text: post.text,
            access_token: conn.accessToken,
          }),
        });
        if (!container.ok) return fail(container.status, problem(name, container));
        const published = await request(`${THREADS_GRAPH}/${userId}/threads_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: String(container.data.id), access_token: conn.accessToken }),
        });
        if (!published.ok) return fail(published.status, problem(name, published));
        const id = String(published.data.id ?? "");
        const link = await request(`${THREADS_GRAPH}/${id}?${new URLSearchParams({ fields: "permalink", access_token: conn.accessToken })}`);
        return {
          ok: true,
          status: published.status,
          detail: `Posted to ${conn.account} on Threads`,
          externalId: id,
          url: typeof link.data.permalink === "string" ? link.data.permalink : undefined,
        };
      }
    }
  } catch (error) {
    return fail(0, `${name} could not be reached: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

// --- editing and deleting -------------------------------------------------------------

export async function editSocial(organizationId: string, platform: SocialPlatform, postId: string, text: string): Promise<DeliveryResult> {
  const name = PLATFORM_NAMES[platform];
  if (!CAN_EDIT[platform]) return fail(0, `${name} doesn't let apps edit a post after it's published.`);
  const conn = await access(organizationId, platform);
  if (!conn) return fail(0, `${name} is not connected.`);
  if (text.length > PLATFORM_LIMIT[platform]) return fail(0, `${name} allows ${PLATFORM_LIMIT[platform]} characters.`);
  try {
    if (platform === "linkedin") {
      const r = await request(`${LINKEDIN}/posts/${encodeURIComponent(postId)}`, {
        method: "POST",
        headers: { ...linkedinHeaders(conn.accessToken), "X-RestLi-Method": "PARTIAL_UPDATE" },
        body: JSON.stringify({ patch: { $set: { commentary: linkedinText(text) } } }),
      });
      return r.ok ? { ok: true, status: r.status, detail: "Edited the LinkedIn post" } : fail(r.status, problem(name, r));
    }
    const page = pageForPost(conn.extra, postId);
    if (!page) return fail(0, "No Facebook Page is connected.");
    const r = await request(`${META_GRAPH}/${postId}`, {
      method: "POST",
      body: new URLSearchParams({ message: text, access_token: page.token }),
    });
    return r.ok ? { ok: true, status: r.status, detail: `Edited the post on ${page.name}` } : fail(r.status, problem(name, r));
  } catch (error) {
    return fail(0, `${name} could not be reached: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function deleteSocial(organizationId: string, platform: SocialPlatform, postId: string): Promise<DeliveryResult> {
  const name = PLATFORM_NAMES[platform];
  if (!CAN_DELETE[platform]) return fail(0, `${name} doesn't let apps delete posts - delete it in the ${name} app.`);
  const conn = await access(organizationId, platform);
  if (!conn) return fail(0, `${name} is not connected.`);
  try {
    let r;
    if (platform === "linkedin") {
      r = await request(`${LINKEDIN}/posts/${encodeURIComponent(postId)}`, { method: "DELETE", headers: linkedinHeaders(conn.accessToken) });
    } else if (platform === "x") {
      r = await request(`https://api.x.com/2/tweets/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${conn.accessToken}` },
      });
    } else {
      const page = pageForPost(conn.extra, postId);
      if (!page) return fail(0, "No Facebook Page is connected.");
      r = await request(`${META_GRAPH}/${postId}?${new URLSearchParams({ access_token: page.token })}`, { method: "DELETE" });
    }
    return r.ok ? { ok: true, status: r.status, detail: `Deleted the ${name} post` } : fail(r.status, problem(name, r));
  } catch (error) {
    return fail(0, `${name} could not be reached: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

// --- reading -----------------------------------------------------------------------

/** Posts Desker itself published: the record kept on each draft. */
async function madeByDesker(organizationId: string, platform: SocialPlatform, limit: number): Promise<string> {
  const drafts = await prisma.draft.findMany({
    where: { organizationId, status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: { title: true, body: true, publishedAt: true, metadata: true },
  });
  const mine = drafts
    .filter((draft) => (draft.metadata as { external?: { platform?: string } } | null)?.external?.platform === platform)
    .slice(0, limit);
  if (mine.length === 0) return `Desker hasn't published anything to ${PLATFORM_NAMES[platform]} yet.`;
  return mine
    .map((draft) => {
      const external = (draft.metadata as { external: { id: string; url?: string } }).external;
      return `- [id: ${external.id}] ${draft.publishedAt?.toISOString().slice(0, 10) ?? ""}: ${draft.body.slice(0, 200)}${external.url ? ` (${external.url})` : ""}`;
    })
    .join("\n");
}

const clip = (text: unknown, max = 280) => String(text ?? "").replace(/\s+/g, " ").slice(0, max);

export async function readSocial(
  organizationId: string,
  input: { platform: SocialPlatform; action: "accounts" | "posts" | "post" | "messages"; postId?: string; limit?: number; account?: string },
): Promise<string> {
  const { platform } = input;
  const name = PLATFORM_NAMES[platform];
  const conn = await access(organizationId, platform);
  if (!conn) throw new Error(`${name} is not connected. The owner can connect it under Integrations.`);
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);

  if (input.action === "accounts") {
    if (platform === "facebook" || platform === "instagram") {
      const pages = (conn.extra.pages as MetaPage[] | undefined) ?? [];
      return pages
        .map((page) => `- Facebook Page: ${page.name} [id: ${page.id}]${page.instagram ? `; Instagram: @${page.instagram.username} [id: ${page.instagram.id}]` : "; no Instagram linked"}`)
        .join("\n");
    }
    return `- ${name}: ${conn.account}`;
  }

  if (input.action === "messages") {
    if (platform !== "instagram") throw new Error(`Reading messages works on Instagram only, not ${name}.`);
    const page = metaPage(conn.extra, platform, input.account);
    if (!page?.instagram) throw new Error("No Instagram business account is linked to your connected Pages.");
    const r = await request(
      `${META_GRAPH}/${page.id}/conversations?${new URLSearchParams({
        platform: "instagram",
        fields: "updated_time,participants,messages.limit(5){message,from,created_time}",
        limit: String(limit),
        access_token: page.token,
      })}`,
    );
    if (!r.ok) {
      throw new Error(
        `${problem(name, r)} The owner may need to reconnect Facebook & Instagram to allow messages, and turn on "Allow access to messages" in Instagram's settings under Privacy > Messages.`,
      );
    }
    const threads = (r.data.data as Array<Record<string, unknown>> | undefined) ?? [];
    if (!threads.length) return `No recent Instagram messages on @${page.instagram.username}.`;
    return threads
      .map((thread) => {
        const messages = ((thread.messages as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [])
          .reverse()
          .map((m) => `    ${String(m.created_time ?? "").slice(0, 16)} @${String((m.from as { username?: string } | undefined)?.username ?? "someone")}: ${clip(m.message, 300)}`)
          .join("\n");
        return `- Conversation, last active ${String(thread.updated_time ?? "").slice(0, 16)}\n${messages}`;
      })
      .join("\n");
  }

  if (input.action === "post" && !input.postId) throw new Error("Give the post_id.");

  switch (platform) {
    case "linkedin":
      // Reading a member's posts needs LinkedIn's partner approval; what Desker made is on record.
      return (
        "LinkedIn doesn't let apps read your posts back, so here are the ones Desker published:\n" +
        (await madeByDesker(organizationId, platform, limit))
      );
    case "facebook": {
      if (input.action === "post") {
        const page = pageForPost(conn.extra, input.postId!);
        const r = await request(
          `${META_GRAPH}/${input.postId}?${new URLSearchParams({
            fields: "id,message,created_time,permalink_url,reactions.summary(total_count).limit(0),comments.limit(20){from,message,created_time}",
            access_token: page?.token ?? "",
          })}`,
        );
        if (!r.ok) throw new Error(problem(name, r));
        const comments = ((r.data.comments as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [])
          .map((c) => `  - ${(c.from as { name?: string } | undefined)?.name ?? "someone"}: ${clip(c.message, 200)}`)
          .join("\n");
        const reactions = (r.data.reactions as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0;
        return `${clip(r.data.message, 2000)}\n${String(r.data.created_time ?? "")} · ${reactions} reactions · ${String(r.data.permalink_url ?? "")}\nComments:\n${comments || "  none"}`;
      }
      const page = metaPage(conn.extra, platform, input.account);
      if (!page) throw new Error("No Facebook Page is connected.");
      const r = await request(
        `${META_GRAPH}/${page.id}/posts?${new URLSearchParams({
          fields: "id,message,created_time,permalink_url,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
          limit: String(limit),
          access_token: page.token,
        })}`,
      );
      if (!r.ok) throw new Error(problem(name, r));
      const posts = (r.data.data as Array<Record<string, unknown>> | undefined) ?? [];
      return posts.length
        ? posts
            .map((post) => {
              const reactions = (post.reactions as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0;
              const comments = (post.comments as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0;
              return `- [id: ${String(post.id)}] ${String(post.created_time ?? "").slice(0, 10)}: ${clip(post.message)} (${reactions} reactions, ${comments} comments)`;
            })
            .join("\n")
        : `No posts on ${page.name} yet.`;
    }
    case "instagram": {
      const page = metaPage(conn.extra, platform, input.account);
      if (!page?.instagram) throw new Error("No Instagram business account is linked to your connected Pages.");
      if (input.action === "post") {
        const r = await request(
          `${META_GRAPH}/${input.postId}?${new URLSearchParams({
            fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count,comments.limit(20){username,text,timestamp}",
            access_token: page.token,
          })}`,
        );
        if (!r.ok) throw new Error(problem(name, r));
        const comments = ((r.data.comments as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [])
          .map((c) => `  - @${String(c.username ?? "someone")}: ${clip(c.text, 200)}`)
          .join("\n");
        return `${clip(r.data.caption, 2200)}\n${String(r.data.timestamp ?? "")} · ${Number(r.data.like_count ?? 0)} likes · ${String(r.data.permalink ?? "")}\nComments:\n${comments || "  none"}`;
      }
      const r = await request(
        `${META_GRAPH}/${page.instagram.id}/media?${new URLSearchParams({
          fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
          limit: String(limit),
          access_token: page.token,
        })}`,
      );
      if (!r.ok) throw new Error(problem(name, r));
      const media = (r.data.data as Array<Record<string, unknown>> | undefined) ?? [];
      return media.length
        ? media
            .map((m) => `- [id: ${String(m.id)}] ${String(m.timestamp ?? "").slice(0, 10)}: ${clip(m.caption)} (${Number(m.like_count ?? 0)} likes, ${Number(m.comments_count ?? 0)} comments)`)
            .join("\n")
        : `No posts on @${page.instagram.username} yet.`;
    }
    case "x": {
      const headers = { authorization: `Bearer ${conn.accessToken}` };
      const fields = "tweet.fields=created_at,public_metrics";
      const r =
        input.action === "post"
          ? await request(`https://api.x.com/2/tweets/${encodeURIComponent(input.postId!)}?${fields}`, { headers })
          : await request(`https://api.x.com/2/users/${encodeURIComponent(String(conn.extra.userId ?? ""))}/tweets?max_results=${Math.max(limit, 5)}&${fields}`, { headers });
      if (r.status === 403 || r.status === 429) {
        return (
          "X only lets apps on a paid API plan read posts, so here are the ones Desker published:\n" +
          (await madeByDesker(organizationId, platform, limit))
        );
      }
      if (!r.ok) throw new Error(problem(name, r));
      const rows = input.action === "post" ? [r.data.data] : ((r.data.data as unknown[] | undefined) ?? []);
      return (
        (rows as Array<Record<string, unknown>>)
          .map((t) => {
            const m = (t.public_metrics as Record<string, number> | undefined) ?? {};
            return `- [id: ${String(t.id)}] ${String(t.created_at ?? "").slice(0, 10)}: ${clip(t.text)} (${m.like_count ?? 0} likes, ${m.reply_count ?? 0} replies, ${m.retweet_count ?? 0} reposts)`;
          })
          .join("\n") || "No posts yet."
      );
    }
    case "threads": {
      if (input.action === "post") {
        const [post, replies] = await Promise.all([
          request(`${THREADS_GRAPH}/${encodeURIComponent(input.postId!)}?${new URLSearchParams({ fields: "id,text,timestamp,permalink", access_token: conn.accessToken })}`),
          request(`${THREADS_GRAPH}/${encodeURIComponent(input.postId!)}/replies?${new URLSearchParams({ fields: "id,text,username,timestamp", access_token: conn.accessToken })}`),
        ]);
        if (!post.ok) throw new Error(problem(name, post));
        const list = ((replies.data.data as Array<Record<string, unknown>> | undefined) ?? [])
          .map((reply) => `  - @${String(reply.username ?? "someone")}: ${clip(reply.text, 200)}`)
          .join("\n");
        return `${clip(post.data.text, 500)}\n${String(post.data.timestamp ?? "")} · ${String(post.data.permalink ?? "")}\nReplies:\n${list || "  none"}`;
      }
      const r = await request(`${THREADS_GRAPH}/me/threads?${new URLSearchParams({ fields: "id,text,timestamp,permalink", limit: String(limit), access_token: conn.accessToken })}`);
      if (!r.ok) throw new Error(problem(name, r));
      const posts = (r.data.data as Array<Record<string, unknown>> | undefined) ?? [];
      return posts.length
        ? posts.map((p) => `- [id: ${String(p.id)}] ${String(p.timestamp ?? "").slice(0, 10)}: ${clip(p.text)}`).join("\n")
        : "No Threads posts yet.";
    }
  }
}

// --- Watching Instagram: competitors, trends, your own numbers ------------------

export const WATCH_ACTIONS = ["competitor", "trending", "insights"] as const;
export type WatchAction = (typeof WATCH_ACTIONS)[number];

export interface WatchedPost {
  caption: string;
  likes: number;
  comments: number;
  at: string;
  url: string;
  type: string;
}

export interface WatchedAccount {
  username: string;
  name: string;
  followers: number;
  posts: number;
  recent: WatchedPost[];
}

const postOf = (m: Record<string, unknown>): WatchedPost => ({
  caption: clip(m.caption, 160),
  likes: Number(m.like_count ?? 0),
  comments: Number(m.comments_count ?? 0),
  at: String(m.timestamp ?? ""),
  url: String(m.permalink ?? ""),
  type: String(m.media_type ?? "").toLowerCase().replace("carousel_album", "carousel"),
});

const line = (p: WatchedPost) => `- ${p.at.slice(0, 10)} ${p.type}: ${p.caption || "(no caption)"} (${p.likes} likes, ${p.comments} comments) ${p.url}`;

/** What changed since the last look: followers, and posts that weren't there then. Pure, so a test holds it. */
export function describeWatch(current: WatchedAccount, previous: WatchedAccount | null, previousAt: Date | null): string {
  const best = [...current.recent].sort((a, b) => b.likes + b.comments - (a.likes + a.comments))[0];
  const average = current.recent.length
    ? Math.round(current.recent.reduce((sum, p) => sum + p.likes + p.comments, 0) / current.recent.length)
    : 0;
  const parts = [`@${current.username}${current.name ? ` (${current.name})` : ""}: ${current.followers.toLocaleString("en")} followers, ${current.posts} posts.`];
  if (previous && previousAt) {
    const seen = new Set(previous.recent.map((p) => p.url));
    const fresh = current.recent.filter((p) => !seen.has(p.url));
    const change = current.followers - previous.followers;
    parts.push(
      `Since ${previousAt.toISOString().slice(0, 16).replace("T", " ")} UTC: ${change >= 0 ? "+" : ""}${change.toLocaleString("en")} followers, ${fresh.length} new post${fresh.length === 1 ? "" : "s"}.`,
    );
    if (fresh.length) parts.push(`New posts:\n${fresh.map(line).join("\n")}`);
  } else {
    parts.push("First look at this account: next time this will say what changed.");
  }
  if (best) parts.push(`Best of the last ${current.recent.length}: ${line(best).slice(2)}\nAverage likes + comments per post: ${average}.`);
  parts.push(`Recent posts:\n${current.recent.slice(0, 6).map(line).join("\n")}`);
  return parts.join("\n");
}

/**
 * Instagram's own business-discovery, hashtag and insights APIs, through the
 * connected Instagram business account. Public business and creator accounts
 * only: Instagram doesn't let any app read personal accounts.
 */
export async function watchInstagram(
  organizationId: string,
  input: { action: WatchAction; handle?: string; tag?: string; account?: string },
): Promise<string> {
  const conn = await access(organizationId, "instagram");
  if (!conn) throw new Error("Instagram is not connected. The owner can connect Facebook & Instagram under Integrations.");
  const page = metaPage(conn.extra, "instagram", input.account);
  if (!page?.instagram) throw new Error("No Instagram business account is linked to your connected Pages.");
  const me = page.instagram.id;
  const token = page.token;

  if (input.action === "competitor") {
    const handle = input.handle?.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
    if (!handle || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) throw new Error("Give the competitor's Instagram username, like @brand.");
    const r = await request(
      `${META_GRAPH}/${me}?${new URLSearchParams({
        fields: `business_discovery.username(${handle}){username,name,followers_count,media_count,media.limit(12){caption,like_count,comments_count,timestamp,permalink,media_type}}`,
        access_token: token,
      })}`,
    );
    if (!r.ok) {
      const detail = problem("Instagram", r);
      if (/cannot be found|does not exist|invalid user/i.test(detail)) {
        throw new Error(`Couldn't read @${handle}: it may be a personal account (Instagram only shares business and creator accounts) or the username is wrong.`);
      }
      throw new Error(detail);
    }
    const found = r.data.business_discovery as Record<string, unknown>;
    const current: WatchedAccount = {
      username: String(found.username ?? handle),
      name: String(found.name ?? ""),
      followers: Number(found.followers_count ?? 0),
      posts: Number(found.media_count ?? 0),
      recent: (((found.media as { data?: Array<Record<string, unknown>> } | undefined)?.data) ?? []).map(postOf),
    };
    const key = `instagram:@${current.username.toLowerCase()}`;
    // "Since yesterday", not "since an hour ago": compare with the last look at least 12 hours old.
    const previous = await prisma.socialSnapshot.findFirst({
      where: { organizationId, key, takenAt: { lt: new Date(Date.now() - 12 * 60 * 60_000) } },
      orderBy: { takenAt: "desc" },
    });
    const latest = await prisma.socialSnapshot.findFirst({ where: { organizationId, key }, orderBy: { takenAt: "desc" }, select: { takenAt: true } });
    if (!latest || Date.now() - latest.takenAt.getTime() > 60 * 60_000) {
      await prisma.socialSnapshot.create({ data: { organizationId, key, data: current as unknown as object } });
      await prisma.socialSnapshot.deleteMany({ where: { organizationId, key, takenAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } });
    }
    const ads = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&search_type=keyword_unordered&q=${encodeURIComponent(current.name || current.username)}`;
    return `${describeWatch(current, previous ? (previous.data as unknown as WatchedAccount) : null, previous?.takenAt ?? null)}\nTheir running ads (Meta Ad Library, open it to look): ${ads}`;
  }

  if (input.action === "trending") {
    const tag = input.tag?.trim().replace(/^#/, "");
    if (!tag || !/^[\p{L}\p{N}_]{1,100}$/u.test(tag)) throw new Error("Give one hashtag, like #coffee.");
    const search = await request(`${META_GRAPH}/ig_hashtag_search?${new URLSearchParams({ user_id: me, q: tag, access_token: token })}`);
    if (!search.ok) throw new Error(problem("Instagram", search));
    const id = (search.data.data as Array<{ id?: string }> | undefined)?.[0]?.id;
    if (!id) return `Nobody uses #${tag} on Instagram yet.`;
    const top = await request(
      `${META_GRAPH}/${id}/top_media?${new URLSearchParams({
        user_id: me,
        fields: "caption,like_count,comments_count,timestamp,permalink,media_type",
        limit: "10",
        access_token: token,
      })}`,
    );
    if (!top.ok) throw new Error(problem("Instagram", top));
    const posts = ((top.data.data as Array<Record<string, unknown>> | undefined) ?? []).map(postOf);
    return posts.length ? `Top posts on #${tag} right now:\n${posts.map(line).join("\n")}` : `No top posts on #${tag} right now.`;
  }

  // Your own account, yesterday: a day's reach, views and interactions, and followers today.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 86_400_000);
  const [account, stats] = await Promise.all([
    request(`${META_GRAPH}/${me}?${new URLSearchParams({ fields: "username,followers_count,media_count", access_token: token })}`),
    request(
      `${META_GRAPH}/${me}/insights?${new URLSearchParams({
        metric: "reach,views,accounts_engaged,total_interactions,likes,comments,shares,saves,profile_views",
        period: "day",
        metric_type: "total_value",
        since: String(start.getTime() / 1000),
        until: String(end.getTime() / 1000),
        access_token: token,
      })}`,
    ),
  ]);
  if (!account.ok) throw new Error(problem("Instagram", account));
  const head = `@${String(account.data.username ?? page.instagram.username)}: ${Number(account.data.followers_count ?? 0).toLocaleString("en")} followers, ${Number(account.data.media_count ?? 0)} posts.`;
  if (!stats.ok) {
    return `${head}\nInstagram didn't share the daily numbers: ${problem("Instagram", stats)} The owner may need to reconnect Facebook & Instagram to allow insights.`;
  }
  const numbers = ((stats.data.data as Array<{ name?: string; total_value?: { value?: number } }> | undefined) ?? [])
    .map((m) => `${String(m.name).replace(/_/g, " ")} ${Number(m.total_value?.value ?? 0).toLocaleString("en")}`)
    .join(", ");
  return `${head}\nYesterday (${start.toISOString().slice(0, 10)}, UTC day): ${numbers || "no activity"}.`;
}
