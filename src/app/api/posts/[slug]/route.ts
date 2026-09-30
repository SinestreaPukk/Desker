import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canManagePosts, generateUniqueSlug, getPostBySlug } from "@/lib/posts";

const updatePostSchema = z.object({
  title: z.string().trim().min(3).optional(),
  category: z.enum(["blog", "patch_notes", "announcement", "news"]).optional(),
  summary: z.string().trim().nullable().optional(),
  content: z.string().trim().min(1).optional(),
  status: z.enum(["published", "draft"]).optional(),
  pinned: z.boolean().optional(),
  authorName: z.string().trim().nullable().optional(),
  slug: z.string().trim().optional(),
});

type Props = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params;
  const isOwner = await canManagePosts();
  const post = await getPostBySlug(slug, { includeDrafts: isOwner });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const isAuthorized = await canManagePosts();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Only the platform owner or admin can edit posts." }, { status: 403 });
  }

  const { slug } = await params;
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.summary !== undefined) data.summary = parsed.data.summary;
  if (parsed.data.content !== undefined) data.content = parsed.data.content;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.pinned !== undefined) data.pinned = parsed.data.pinned;
  if (parsed.data.authorName !== undefined) data.authorName = parsed.data.authorName;

  if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
    data.slug = await generateUniqueSlug(parsed.data.slug, existing.id);
  }

  const updated = await prisma.post.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ post: updated });
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const isAuthorized = await canManagePosts();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Only the platform owner or admin can delete posts." }, { status: 403 });
  }

  const { slug } = await params;
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  await prisma.post.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
