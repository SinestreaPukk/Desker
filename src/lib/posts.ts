import { POSTS } from "../../content/posts";

export * from "@/lib/post-types";

/** Published posts, pinned first, then newest. */
export function getPosts() {
  return [...POSTS].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

export function getPostBySlug(slug: string) {
  return POSTS.find((post) => post.slug === slug) ?? null;
}
