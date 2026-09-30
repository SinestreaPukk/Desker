"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Edit, Pin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { POST_CATEGORIES, type PostCategory, type SerializedPost } from "@/lib/post-types";
import { cn } from "@/lib/utils";

export type { SerializedPost };

export function BlogFeed({
  initialPosts,
  isOwner,
}: {
  initialPosts: SerializedPost[];
  isOwner: boolean;
}) {
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const categories = [
    { id: "all", label: "All updates" },
    { id: "blog", label: "Blog" },
    { id: "patch_notes", label: "Patch Notes" },
    { id: "announcement", label: "Announcements" },
    { id: "news", label: "News" },
    ...(isOwner ? [{ id: "drafts", label: "Drafts" }] : []),
  ];

  const filteredPosts = React.useMemo(() => {
    return initialPosts.filter((post) => {
      // Category filter
      if (activeCategory === "drafts") {
        if (post.status !== "draft") return false;
      } else if (activeCategory !== "all") {
        if (post.category !== activeCategory) return false;
        if (post.status === "draft" && !isOwner) return false;
      } else {
        if (post.status === "draft" && !isOwner) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = post.title.toLowerCase().includes(query);
        const matchesSummary = post.summary?.toLowerCase().includes(query);
        const matchesContent = post.content.toLowerCase().includes(query);
        return matchesTitle || matchesSummary || matchesContent;
      }

      return true;
    });
  }, [initialPosts, activeCategory, searchQuery, isOwner]);

  const draftCount = initialPosts.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-8">
      {/* Owner controls banner */}
      {isOwner ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent/20 bg-accent-soft/30 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-2.5 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-medium text-ink">
              Owner Mode: You can publish new blog posts, patch notes, announcements, and news.
            </span>
            {draftCount > 0 ? (
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                {draftCount} {draftCount === 1 ? "draft" : "drafts"}
              </span>
            ) : null}
          </div>
          <Button asChild size="sm">
            <Link href="/blog/new">
              <Plus className="size-4 mr-1.5" />
              Write new post
            </Link>
          </Button>
        </div>
      ) : null}

      {/* Category selector & Search bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface p-1">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-fg shadow-xs"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search updates…"
            className="w-full rounded-md border border-line bg-surface py-1.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Posts list */}
      {filteredPosts.length === 0 ? (
        <Panel className="p-12 text-center">
          <p className="text-base font-semibold text-ink">No updates found</p>
          <p className="mt-1 text-sm text-ink-muted">
            {searchQuery
              ? `No articles matching "${searchQuery}". Try clearing your search.`
              : "No posts published in this category yet."}
          </p>
          {isOwner ? (
            <div className="mt-6">
              <Button asChild size="sm">
                <Link href="/blog/new">Write the first update</Link>
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <div className="grid gap-6">
          {filteredPosts.map((post) => {
            const categoryMeta = POST_CATEGORIES[post.category as PostCategory] ?? POST_CATEGORIES.blog;
            const published = new Date(post.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <Panel
                key={post.id}
                className={cn(
                  "group relative transition-all hover:border-accent-line hover:shadow-xs",
                  post.pinned ? "border-accent/40 bg-surface" : "bg-surface",
                )}
              >
                <div className="p-6 sm:p-7">
                  {/* Top metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold tracking-wide",
                          categoryMeta.badgeClass,
                        )}
                      >
                        {categoryMeta.label}
                      </span>
                      {post.pinned ? (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft/40 px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
                          <Pin className="size-3" />
                          Pinned
                        </span>
                      ) : null}
                      {post.status === "draft" ? (
                        <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                          Draft
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <time className="text-xs text-ink-muted" dateTime={new Date(post.publishedAt).toISOString()}>
                        {published}
                      </time>
                      {isOwner ? (
                        <Link
                          href={`/blog/${post.slug}/edit`}
                          className="relative z-10 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          <Edit className="size-3" />
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {/* Title & summary */}
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="after:absolute after:inset-0 hover:text-accent transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>

                  {post.summary ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-base">
                      {post.summary}
                    </p>
                  ) : null}

                  {/* Footer line */}
                  <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-4 text-xs text-ink-muted">
                    <span>By {post.authorName || "Desker Team"}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-accent">
                      Read update
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
