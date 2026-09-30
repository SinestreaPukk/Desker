import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostEditor } from "@/components/blog/post-editor";
import { canManagePosts } from "@/lib/posts";
import { pageMetadata } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "New Post — Blog & Updates",
  description: "Write and publish a new post, patch note, announcement, or news article.",
  path: "/blog/new",
});

export default async function NewPostPage() {
  const isOwner = await canManagePosts();
  if (!isOwner) {
    redirect("/login?callbackUrl=/blog/new");
  }

  return (
    <div className="py-8">
      <PostEditor mode="create" />
    </div>
  );
}
