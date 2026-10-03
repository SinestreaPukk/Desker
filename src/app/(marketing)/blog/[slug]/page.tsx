import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pin } from "lucide-react";
import { PageHeader } from "@/components/marketing/page-header";
import { Markdown } from "@/components/markdown";
import { getPostBySlug, POST_CATEGORIES, type PostCategory } from "@/lib/posts";
import { pageMetadata } from "@/lib/content";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return pageMetadata({
    title: `${post.title} — Desker Updates`,
    description: post.summary || post.content.slice(0, 160).replace(/[#*`_]/g, ""),
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const categoryMeta = POST_CATEGORIES[post.category as PostCategory] ?? POST_CATEGORIES.blog;
  const publishedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <PageHeader
        title={post.title}
        intro={post.summary ?? undefined}
        eyebrow={categoryMeta.label}
      >
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <time dateTime={new Date(post.publishedAt).toISOString()}>{publishedDate}</time>
          <span>·</span>
          <span>By {post.authorName || "Desker Team"}</span>
          {post.pinned ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
                <Pin className="size-3" />
                Pinned
              </span>
            </>
          ) : null}
        </div>
      </PageHeader>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All updates
          </Link>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6 sm:p-10">
          <Markdown text={post.content} size="page" />
        </div>

        <div className="mt-12 flex items-center border-t border-line pt-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to all updates
          </Link>

        </div>
      </article>
    </>
  );
}
