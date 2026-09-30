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
  input: { platform: SocialPlatform; action: "accounts" | "posts" | "post"; postId?: string; limit?: number; account?: string },
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
