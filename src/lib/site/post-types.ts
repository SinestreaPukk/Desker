export type PostCategory = "blog" | "patch_notes" | "announcement" | "news";
export interface CategoryInfo {
  id: PostCategory;
  label: string;
  description: string;
  badgeClass: string;
}

export const POST_CATEGORIES: Record<PostCategory, CategoryInfo> = {
  blog: {
    id: "blog",
    label: "Blog",
    description: "In-depth thoughts, product design, and architectural perspectives.",
    badgeClass: "bg-accent-soft text-accent-soft-fg border-accent-line/60",
  },
  patch_notes: {
    id: "patch_notes",
    label: "Patch Notes",
    description: "Changelog, newly shipped features, improvements, and fixes.",
    badgeClass: "bg-positive-soft text-positive border-positive-line/60",
  },
  announcement: {
    id: "announcement",
    label: "Announcement",
    description: "Major milestones, company news, and platform releases.",
    badgeClass: "bg-warning-soft text-warning border-warning-line/60",
  },
  news: {
    id: "news",
    label: "News",
    description: "Platform updates, ecosystem announcements, and community notes.",
    badgeClass: "bg-surface-2 text-ink border-line",
  },
};

export interface SerializedPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  status: string;
  pinned: boolean;
  authorName: string | null;
  authorEmail: string | null;
  publishedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
