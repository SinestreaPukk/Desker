import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/marketing/page-header";
import { Panel } from "@/components/ui/panel";
import { GUIDES } from "@/lib/site/guides";
import { pageMetadata } from "@/lib/site/content";

export const metadata: Metadata = pageMetadata({
  title: "Guides",
  description:
    "Short, specific how-tos: setting up private assistants for your own life, approvals and privacy. Two minutes each.",
  path: "/guides",
});

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
        <ul className="grid gap-3 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
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
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
