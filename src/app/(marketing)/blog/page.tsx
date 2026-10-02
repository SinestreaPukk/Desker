import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/page-header";
import { BlogFeed } from "@/components/blog/blog-feed";
import type { SerializedPost } from "@/lib/post-types";
import { canManagePosts, getPosts } from "@/lib/posts";
import { pageMetadata } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Blog & Updates",
  description:
    "Product updates, patch notes, announcements, and thoughts on AI employees with human-in-the-loop sign-off.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const isOwner = await canManagePosts();
  const rawPosts = await getPosts({ includeDrafts: isOwner });

  const posts: SerializedPost[] = rawPosts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    category: post.category,
    summary: post.summary,
    content: post.content,
    status: post.status,
    pinned: post.pinned,
    authorName: post.authorName,
    authorEmail: post.authorEmail,
    publishedAt: post.publishedAt.toISOString(),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Blog & Updates"
        intro="Product updates, patch notes, announcements, and perspectives on building reliable AI assistants."
        eyebrow="Desker Journal"
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <BlogFeed initialPosts={posts} isOwner={isOwner} />
      </div>
    </>
  );
}
