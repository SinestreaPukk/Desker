import "server-only";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { organizationsFor } from "@/lib/organizations";
import { slugify } from "@/lib/slug";
import { SITE } from "@/lib/content";

import { PrismaClient } from "@prisma/client";

export * from "@/lib/post-types";

/**
 * Checks whether the current user is permitted to create, edit, or delete posts.
 * Owners and admins of any organisation, as well as the platform admin/contact email,
 * are authorized.
 */
export async function canManagePosts(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const adminEmails = [
    process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    SITE.company.email.trim().toLowerCase(),
    "admin@example.com",
  ].filter(Boolean);

  if (adminEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  const orgs = await organizationsFor(user.id);
  return orgs.some((org) => org.role === "owner" || org.role === "admin");
}

function getPostDelegate(): PrismaClient["post"] {
  if (prisma.post) return prisma.post;
  // If running in dev server where globalThis has an old PrismaClient instance without .post:
  const freshClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  (globalThis as unknown as { prisma?: PrismaClient }).prisma = freshClient;
  return freshClient.post;
}

export async function getPosts(options?: {
  category?: string;
  includeDrafts?: boolean;
}) {
  await seedInitialPostsIfEmpty();

  const where: {
    category?: string;
    status?: string;
  } = {};

  if (options?.category && options.category !== "all") {
    where.category = options.category;
  }

  if (!options?.includeDrafts) {
    where.status = "published";
  }

  return getPostDelegate().findMany({
    where,
    orderBy: [
      { pinned: "desc" },
      { publishedAt: "desc" },
    ],
  });
}

export async function getPostBySlug(slug: string, options?: { includeDrafts?: boolean }) {
  await seedInitialPostsIfEmpty();

  const post = await getPostDelegate().findUnique({
    where: { slug },
  });

  if (!post) return null;
  if (post.status !== "published" && !options?.includeDrafts) {
    return null;
  }

  return post;
}

export async function generateUniqueSlug(title: string, currentId?: string): Promise<string> {
  const base = slugify(title, "post");
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await getPostDelegate().findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || (currentId && existing.id === currentId)) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter++;
  }
}

const INITIAL_POSTS = [
  {
    slug: "welcome-to-desker-ai-staff-for-your-business",
    title: "Welcome to Desker: AI staff for your business, AI help for your life",
    category: "announcement" as const,
    pinned: true,
    summary:
      "Today we are opening early access to Desker: hire dedicated AI employees for research, content, sales and support, alongside private assistants for your own life.",
    content: `## A new kind of desk

Most AI tools act like a search box or a blank text cursor: you type a prompt, wait for an answer, copy-paste it somewhere else, and do the actual work yourself.

Desker is built around a different idea: **AI employees with roles, routines, and boundaries.**

Each agent you hire has a job description, an inbox, and a scope of work. They check documents you upload under Knowledge, carry out research, monitor tasks on schedules, and prepare output for you.

### Two spaces, walled apart

Desker gives you two distinct workspaces:
- **Business spaces:** For companies and small teams. Agents handle customer tickets, draft social posts, research market competitors, and prepare sales decks.
- **Personal spaces:** For your personal life. Private assistants help you track spending statements, organize your week, plan travel, and manage routines—with zero sharing and zero public access.

### Autonomy with human sign-off

The core commitment of Desker is simple: **Nothing leaves without you.**

Agents can draft emails, prepare calendar invites, and write articles, but outward actions pause in your **Needs you** queue for your review. You inspect what was done, make quick edits if you want, and click Approve—or send a correction that the agent remembers for next time.

We are excited to build this with you. Explore the [showcase](/showcase) to see all 14 ready-to-hire roles, or read our [guides](/guides) to get started.`,
    authorName: "Desker Team",
    authorEmail: SITE.company.email,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    slug: "september-2026-patch-notes-support-inboxes-and-agent-rules",
    title: "Patch Notes: Support Inboxes, Custom Agent Rules & Pure Light Design",
    category: "patch_notes" as const,
    pinned: false,
    summary:
      "Support Inboxes integration for Zendesk, Intercom and Front, customizable Agent Rules memory, separate Needs You queue, and a redesigned crisp paper theme.",
    content: `## What's new in this release

This update brings deeper customer support connections, persistent rule learning for agents, and design improvements across the platform.

### Support Inboxes Integration
Connect your company's existing customer support channels directly to Desker:
- **Zendesk, Intercom, Freshdesk, Front, and Help Scout** can now be selected in Project Settings under Inboxes.
- Support agents can automatically inspect incoming tickets, search uploaded knowledge bases, and draft recommended replies for human review.
- Custom webhook token routing for automated intake.

### Agent Rules & Persistent Corrections
Agents now maintain a structured list of behavioral rules derived from your corrections:
- When you reject or edit an agent's draft, you can save the correction as a standing rule.
- Rules are injected directly into the agent's prompt during subsequent runs so they never make the same mistake twice.
- You can inspect, edit, or delete any agent's rules under the agent's profile in the Roster.

### Refined Paper Studio Theme
- Completely unified light design system inspired by a physical stationery studio: navy ink on crisp white paper with faint blue dot grids.
- Fully audited for WCAG 2.1 AA contrast compliance across all controls and surfaces.
- Improved readability and reduced eye strain during long working sessions.

### Other Improvements
- **Action items separation:** Divided into a dedicated **Needs you** queue (approvals, escalations, problem tickets) and **Conversations** (chat transcripts).
- **Google OAuth Compliance:** Added full disclosures and compliance with Google API Services Limited Use requirements.
- **Performance:** Optimized query caching and reduced page bundle sizes.`,
    authorName: "Desker Team",
    authorEmail: SITE.company.email,
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    slug: "why-ai-employees-should-stop-for-approval",
    title: "Why AI employees should stop for approval before anything leaves the building",
    category: "blog" as const,
    pinned: false,
    summary:
      "Full autonomy without guardrails creates anxiety, not productivity. Why human-in-the-loop approvals are the foundation of trustworthy AI teams.",
    content: `## The autonomy paradox

The prevailing fantasy of autonomous AI agents is that you push a button, walk away, and an AI handles your email, talks to your clients, and runs your business.

In practice, full autonomy without sign-off produces anxiety rather than relief. You spend your day wondering:
- *Did it send the right pricing to that prospect?*
- *Did it promise something our service cannot deliver?*
- *Did it misunderstand a delicate customer email?*

When you don't trust what an agent might do while your back is turned, you end up doing the work twice.

## Sign-off as a feature, not a bottleneck

At Desker, we designed the review workflow as a first-class primitive:

1. **The agent does 90% of the legwork:** It searches documents, synthesizes context, checks calendars, and produces a finished draft.
2. **The work lands in one place:** Everything waiting on a human sits in **Needs you**. You don't have to hunt across 10 inboxes.
3. **Approvals are one-click:** You read the summary, glance at the drafted response, and approve it in seconds.
4. **Corrections become memory:** If a tone wasn't quite right, you tweak a phrase and click Save Rule. Next time, the agent gets it right.

This model preserves the speed of automation while keeping you firmly in control of your business's reputation and voice.`,
    authorName: "Sakditouch",
    authorEmail: SITE.company.email,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];

let seeded = false;

export async function seedInitialPostsIfEmpty() {
  if (seeded) return;
  try {
    const delegate = getPostDelegate();
    const count = await delegate.count();
    if (count === 0) {
      for (const item of INITIAL_POSTS) {
        await delegate.create({
          data: item,
        });
      }
    }
    seeded = true;
  } catch (error) {
    console.error("[posts] Failed to check or seed initial posts:", error);
  }
}
