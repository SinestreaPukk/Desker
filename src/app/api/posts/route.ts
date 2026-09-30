import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canManagePosts, generateUniqueSlug, getPosts } from "@/lib/posts";
import { currentUser } from "@/lib/auth";

const createPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  category: z.enum(["blog", "patch_notes", "announcement", "news"]).default("blog"),
  summary: z.string().trim().optional(),
  content: z.string().trim().min(1, "Post content cannot be empty."),
  status: z.enum(["published", "draft"]).default("published"),
  pinned: z.boolean().default(false),
  authorName: z.string().trim().optional(),
  slug: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const includeDraftsParam = searchParams.get("includeDrafts") === "true";

  let includeDrafts = false;
  if (includeDraftsParam) {
    const isOwner = await canManagePosts();
    includeDrafts = isOwner;
  }

  const posts = await getPosts({ category, includeDrafts });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const isAuthorized = await canManagePosts();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Only the platform owner or admin can create posts." }, { status: 403 });
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post data" }, { status: 400 });
  }

  const { title, category, summary, content, status, pinned, authorName, slug: customSlug } = parsed.data;
  const finalSlug = customSlug ? await generateUniqueSlug(customSlug) : await generateUniqueSlug(title);

  const post = await prisma.post.create({
    data: {
      slug: finalSlug,
      title,
      category,
      summary: summary || null,
      content,
      status,
      pinned,
      authorName: authorName || user?.name || "Desker Team",
      authorEmail: user?.email ?? null,
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
