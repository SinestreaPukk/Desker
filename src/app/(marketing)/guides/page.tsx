import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/marketing/page-header";
import { Reveal } from "@/components/marketing/reveal";
import { Panel } from "@/components/ui/panel";
import { GUIDES, guidesFor } from "@/lib/guides";
import { pageMetadata } from "@/lib/content";

export const metadata: Metadata = pageMetadata({
  title: "Guides",
  description:
    "Short, specific how-tos: hiring AI staff for a business, setting up private assistants for your own life, approvals and privacy. Two minutes each.",
  path: "/guides",
});

/** Business first, then personal, then what both share - the help panel's split. */
const GROUPS = [
  { id: "business", heading: "For your business", guides: guidesFor("business").filter((g) => g.audience === "business") },
  { id: "personal", heading: "For your personal space", guides: guidesFor("personal").filter((g) => g.audience === "personal") },
  { id: "all", heading: "For both", guides: GUIDES.filter((g) => g.audience === "all") },
];

/**
 * The same guides the help panel inside the app reads, on the public site.
 * One source (lib/guides.ts), two readers: nothing is written twice, and a
 * link someone was sent works whether or not they have an account.
 */
export default function GuidesPage() {
  return (
    <>
      <PageHeader
        title="Guides"
        intro="How to do one thing at a time. Each is a two-minute read, and each one is what the help panel inside the app shows."
        eyebrow={`${GUIDES.length} guides`}
      />

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-16 sm:px-6 sm:py-20">
      {GROUPS.map((group) => (
      <section key={group.id} aria-labelledby={`guides-${group.id}`}>
        <h2 id={`guides-${group.id}`} className="mb-5 font-hand text-hand-cta font-bold text-ink">
          {group.heading}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {group.guides.map((guide, index) => (
            <li key={guide.slug}>
              <Reveal delay={index * 0.04}>
                <Panel className="group relative h-full p-5 transition-colors hover:border-accent-line">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <BookOpen className="size-4" aria-hidden />
                    <span className="meta">{guide.minutes} min read</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">
                    <Link href={`/guides/${guide.slug}`} className="after:absolute after:inset-0">
                      {guide.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{guide.summary}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
                    Read it
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </p>
                </Panel>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
      ))}
      </div>
    </>
  );
}
