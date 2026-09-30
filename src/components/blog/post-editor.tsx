"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Markdown } from "@/components/markdown";
import {
  POST_CATEGORIES,
  type PostCategory,
  type PostStatus,
  type SerializedPost,
} from "@/lib/post-types";
import { slugify } from "@/lib/slug";

export function PostEditor({
  mode,
  initialPost,
}: {
  mode: "create" | "edit";
  initialPost?: SerializedPost;
}) {
  const router = useRouter();

  const [title, setTitle] = React.useState(initialPost?.title ?? "");
  const [slug, setSlug] = React.useState(initialPost?.slug ?? "");
  const [customSlug, setCustomSlug] = React.useState(Boolean(initialPost?.slug));
  const [category, setCategory] = React.useState<PostCategory>(
    (initialPost?.category as PostCategory) ?? "blog",
  );
  const [summary, setSummary] = React.useState(initialPost?.summary ?? "");
  const [content, setContent] = React.useState(initialPost?.content ?? "");
  const [status, setStatus] = React.useState<PostStatus>(
    (initialPost?.status as PostStatus) ?? "published",
  );
  const [pinned, setPinned] = React.useState(initialPost?.pinned ?? false);
  const [authorName, setAuthorName] = React.useState(initialPost?.authorName ?? "");
  const [tab, setTab] = React.useState<"write" | "preview">("write");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Auto-generate slug from title unless manually customized
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!customSlug && mode === "create") {
      setSlug(slugify(val, "post"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title for the post.");
      return;
    }
    if (!content.trim()) {
      toast.error("Please enter markdown content for the post.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim() || undefined,
            category,
            summary: summary.trim() || undefined,
            content: content.trim(),
            status,
            pinned,
            authorName: authorName.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create post");
        }

        toast.success(status === "published" ? "Post published successfully!" : "Draft saved!");
        router.push(`/blog/${data.post.slug}`);
        router.refresh();
      } else if (mode === "edit" && initialPost) {
        const res = await fetch(`/api/posts/${initialPost.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim() || undefined,
            category,
            summary: summary.trim() || null,
            content: content.trim(),
            status,
            pinned,
            authorName: authorName.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update post");
        }

        toast.success("Post updated successfully!");
        router.push(`/blog/${data.post.slug}`);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialPost) return;
    const confirmed = window.confirm("Are you sure you want to delete this post? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${initialPost.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete post");
      }

      toast.success("Post deleted.");
      router.push("/blog");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/blog">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to blog
            </Link>
          </Button>
          <span className="text-sm font-semibold text-ink">
            {mode === "create" ? "New post" : `Editing: ${initialPost?.title}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="text-danger hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete
            </Button>
          ) : null}

          <Button type="submit" disabled={saving}>
            <Check className="mr-1.5 size-4" />
            {saving ? "Saving…" : status === "published" ? (mode === "create" ? "Publish" : "Update") : "Save draft"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Editor (2 columns on lg) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title */}
          <div>
            <label htmlFor="post-title" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g., September 2026 Patch Notes"
              className="mt-2 w-full rounded-md border border-line bg-surface px-4 py-2.5 text-lg font-semibold text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Slug */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="post-slug" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                URL Slug
              </label>
              {!customSlug && (
                <button
                  type="button"
                  onClick={() => setCustomSlug(true)}
                  className="text-xs text-accent hover:underline"
                >
                  Edit custom slug
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted">
              <span>https://desker.dev/blog/</span>
              <input
                id="post-slug"
                type="text"
                disabled={!customSlug && mode === "create"}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="post-slug"
                className="ml-0.5 flex-1 bg-transparent font-mono text-xs text-ink focus:outline-none"
              />
            </div>
          </div>

          {/* Summary / Excerpt */}
          <div>
            <label htmlFor="post-summary" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Short Summary / Preview
            </label>
            <textarea
              id="post-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A brief 1-2 sentence description shown in the feed cards and search results."
              className="mt-2 w-full rounded-md border border-line bg-surface p-3 text-sm leading-relaxed text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Content (Write / Preview Tabs) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Content (Markdown)
              </label>
              <div className="inline-flex rounded-md border border-line bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTab("write")}
                  className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium transition-colors ${
                    tab === "write" ? "bg-accent-soft text-accent-soft-fg" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <PenLine className="size-3.5" />
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setTab("preview")}
                  className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium transition-colors ${
                    tab === "preview" ? "bg-accent-soft text-accent-soft-fg" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Eye className="size-3.5" />
                  Preview
                </button>
              </div>
            </div>

            {tab === "write" ? (
              <div>
                <textarea
                  rows={16}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your post content using standard Markdown (## Headings, **bold**, lists, `code`, links)..."
                  className="w-full font-mono text-sm leading-relaxed rounded-md border border-line bg-surface p-4 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1.5 text-xs text-ink-subtle">
                  Supports headings (<code>## Heading</code>), lists (<code>- item</code>), links (<code>[text](url)</code>), and code snippets.
                </p>
              </div>
            ) : (
              <Panel className="min-h-[20rem] p-6 bg-surface">
                {content.trim() ? (
                  <Markdown text={content} size="page" />
                ) : (
                  <p className="italic text-ink-subtle">Nothing written to preview yet.</p>
                )}
              </Panel>
            )}
          </div>
        </div>

        {/* Sidebar settings (1 column on lg) */}
        <div className="space-y-6">
          <Panel className="p-5 space-y-5 bg-surface">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Publishing settings
            </h3>

            {/* Category */}
            <div>
              <label htmlFor="post-category" className="block text-xs font-medium text-ink">
                Category
              </label>
              <select
                id="post-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as PostCategory)}
                className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {Object.values(POST_CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-subtle">
                {POST_CATEGORIES[category]?.description}
              </p>
            </div>

            {/* Status (Published vs Draft) */}
            <div>
              <span className="block text-xs font-medium text-ink">Status</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                    className="accent-primary"
                  />
                  <span>Published (visible to all visitors)</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === "draft"}
                    onChange={() => setStatus("draft")}
                    className="accent-primary"
                  />
                  <span>Draft (only visible to you)</span>
                </label>
              </div>
            </div>

            {/* Pinned post */}
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <span className="text-xs font-medium text-ink">Pin to top</span>
                  <p className="text-xs text-ink-subtle">
                    Pins this announcement or note to the top of the blog feed.
                  </p>
                </div>
              </label>
            </div>

            {/* Author name */}
            <div>
              <label htmlFor="post-author" className="block text-xs font-medium text-ink">
                Author name
              </label>
              <input
                id="post-author"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Desker Team"
                className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </Panel>
        </div>
      </div>
    </form>
  );
}
