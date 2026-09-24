import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/marketing/page-header";
import { Markdown } from "@/components/markdown";
import { GUIDES, guideBySlug } from "@/lib/guides";
import { pageMetadata } from "@/lib/content";

type Params = { params: Promise<{ slug: string }> };

/** Every guide is a static page: they change when the content does, not per request. */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/guides/${guide.slug}`,
  });
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const index = GUIDES.findIndex((entry) => entry.slug === guide.slug);
  const next = GUIDES[(index + 1) % GUIDES.length];

  return (
    <>
      <PageHeader title={guide.title} intro={guide.summary} eyebrow={`${guide.minutes} min read`} />

      <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-16">
        {guide.sections.length > 1 ? (
          <nav aria-label="On this page" className="mb-8 rounded-lg border border-line bg-surface p-4">
            <p className="meta mb-2">On this page</p>
            <ul className="space-y-1.5">
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <Link href={`#${section.id}`} className="text-sm text-accent hover:underline">
                    {section.heading}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <Markdown text={guide.body} size="page" />

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All guides
          </Link>
          {next && next.slug !== guide.slug ? (
            <Link
              href={`/guides/${next.slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              Next: {next.title}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </article>
    </>
  );
}
