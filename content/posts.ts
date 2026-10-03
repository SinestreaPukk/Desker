import type { SerializedPost } from "@/lib/site/post-types";

import site from "./site.json";

const SITE_EMAIL = site.company.email;

export const POSTS: SerializedPost[] = [
  {
    id: "welcome-to-desker-private-ai-help-for-your-life",
    slug: "welcome-to-desker-private-ai-help-for-your-life",
    status: "published",
    title: "Welcome to Desker: private AI help for your life",
    category: "announcement",
    pinned: true,
    summary:
      "Today we are opening early access to Desker: private AI assistants for your own money, week and plans.",
    content: `## A new kind of desk

Most AI tools act like a search box or a blank text cursor: you type a prompt, wait for an answer, copy-paste it somewhere else, and do the actual work yourself.

Desker is built around a different idea: **AI assistants with roles, routines, and boundaries.**

Each agent you hire has a job description, an inbox, and a scope of work. They check documents you upload under Knowledge, carry out research, monitor tasks on schedules, and prepare output for you.

### Private by design

Your space is yours alone. Private assistants help you track spending statements, organize your week, plan travel, and manage routines - with zero sharing and zero public access.

### Autonomy with human sign-off

The core commitment of Desker is simple: **Nothing leaves without you.**

Agents can draft emails, prepare calendar invites, and write articles, but outward actions pause in your **Needs you** queue for your review. You inspect what was done, make quick edits if you want, and click Approve—or send a correction that the agent remembers for next time.

We are excited to build this with you. Read our [guides](/guides) to get started.`,
    authorName: "Desker Team",
    authorEmail: SITE_EMAIL,
    publishedAt: "2026-09-30T09:00:00.000Z",
    createdAt: "2026-09-30T09:00:00.000Z",
    updatedAt: "2026-09-30T09:00:00.000Z",
  },
  {
    id: "why-ai-employees-should-stop-for-approval",
    slug: "why-ai-employees-should-stop-for-approval",
    status: "published",
    title: "Why AI assistants should stop for approval before anything leaves the building",
    category: "blog",
    pinned: false,
    summary:
      "Full autonomy without guardrails creates anxiety, not productivity. Why human-in-the-loop approvals are the foundation of trustworthy AI assistants.",
    content: `## The autonomy paradox

The prevailing fantasy of autonomous AI agents is that you push a button, walk away, and an AI handles your email, your bills, and your calendar.

In practice, full autonomy without sign-off produces anxiety rather than relief. You spend your day wondering:
- *Did it send that message to the right person?*
- *Did it promise something you cannot deliver?*
- *Did it misunderstand a delicate email?*

When you don't trust what an agent might do while your back is turned, you end up doing the work twice.

## Sign-off as a feature, not a bottleneck

At Desker, we designed the review workflow as a first-class primitive:

1. **The agent does 90% of the legwork:** It searches documents, synthesizes context, checks calendars, and produces a finished draft.
2. **The work lands in one place:** Everything waiting on a human sits in **Needs you**. You don't have to hunt across 10 inboxes.
3. **Approvals are one-click:** You read the summary, glance at the drafted response, and approve it in seconds.
4. **Corrections become memory:** If a tone wasn't quite right, you tweak a phrase and click Save Rule. Next time, the agent gets it right.

This model preserves the speed of automation while keeping you firmly in control of your own voice.`,
    authorName: "Sakditouch",
    authorEmail: SITE_EMAIL,
    publishedAt: "2026-10-01T09:00:00.000Z",
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
  },
];
