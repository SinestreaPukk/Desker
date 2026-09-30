import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PostEditor } from "@/components/blog/post-editor";
import type { SerializedPost } from "@/lib/post-types";
import { canManagePosts, getPostBySlug } from "@/lib/posts";
import { pageMetadata } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug, { includeDrafts: true });
  if (!post) return {};

  return pageMetadata({
    title: `Edit: ${post.title} — Desker Updates`,
    description: `Edit post: ${post.title}`,
    path: `/blog/${post.slug}/edit`,
  });
}

export default async function EditPostPage({ params }: Params) {
  const { slug } = await params;
  const isOwner = await canManagePosts();
  if (!isOwner) {
    redirect(`/login?callbackUrl=/blog/${slug}/edit`);
  }

  const post = await getPostBySlug(slug, { includeDrafts: true });
  if (!post) {
    notFound();
  }

  const serializedPost: SerializedPost = {
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
  };

  return (
    <div className="py-8">
      <PostEditor mode="edit" initialPost={serializedPost} />
    </div>
  );
}
