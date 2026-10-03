import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/page-header";
import { BlogFeed } from "@/components/blog/blog-feed";
import { getPosts } from "@/lib/posts";
import { pageMetadata } from "@/lib/content";

export const metadata: Metadata = pageMetadata({
  title: "Blog & Updates",
  description:
    "Product updates, patch notes, announcements, and thoughts on AI employees with human-in-the-loop sign-off.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = getPosts();

  return (
    <>
      <PageHeader
        title="Blog & Updates"
        intro="Product updates, patch notes, announcements, and perspectives on building reliable AI assistants."
        eyebrow="Desker Journal"
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <BlogFeed initialPosts={posts} />
      </div>
    </>
  );
}
