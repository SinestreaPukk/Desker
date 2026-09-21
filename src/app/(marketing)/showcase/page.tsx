import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLASS_BUTTON } from "@/components/marketing/glass-button";
import { PageHeader } from "@/components/marketing/page-header";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { Reveal } from "@/components/marketing/reveal";
import { LANDING, SHOWCASE, TEMPLATES, pageMetadata } from "@/lib/content";

export const metadata: Metadata = pageMetadata({
  title: SHOWCASE.meta.title,
  description: SHOWCASE.meta.description,
  path: "/showcase",
});

/**
 * Every role, from the same records the hire wizard starts from. Adding a
 * template to content/templates.json puts it here with no other change.
 *
 * Eight roles is a long page and most arrivals are deep links - every card in
 * the landing page's bento points at an anchor here - so the sky band carries
 * an index, and each role is a block of its own with the worked example in a
 * frame beside it.
 */
export default function ShowcasePage() {
  return (
    <>
      <PageHeader title={SHOWCASE.heading} intro={SHOWCASE.intro} eyebrow={`${TEMPLATES.length} roles`} />

      {/* The index sits on paper rather than in the sky: it is one row wide at
          1920 and eight rows deep at 390, and no fixed gradient can keep white
          type on the deep band through that. One row at every width here, and
          it scrolls sideways on a phone like the showreel's tabs. */}
      <nav
        aria-label="Roles"
        className="sticky top-14 z-20 border-y border-line bg-paper/85 backdrop-blur-md"
      >
        <ul className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
          {TEMPLATES.map((role) => (
            <li key={role.id}>
              <Link
                href={`#${role.id}`}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent-line hover:text-ink"
              >
                <TemplateIcon icon={role.icon} className="size-3.5" />
                {role.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-16">
        <ol className="space-y-6">
          {TEMPLATES.map((role) => (
            <li key={role.id} id={role.id} className="scroll-mt-32">
              <Reveal>
                <div className="grid gap-6 rounded-panel border border-line bg-surface p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8">
                  <div className="flex flex-col">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent-soft-fg">
                      <TemplateIcon icon={role.icon} className="size-5" />
                    </span>
                    <h2 className="mt-4 text-xl font-medium tracking-tight text-ink">{role.name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {role.jobTitle}
                      {role.team ? ` · ${role.team}` : ""}
                    </p>
                    <p className="mt-3 text-base leading-relaxed text-ink-muted">{role.pitch}</p>
                    {role.escalationRule ? (
                      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">Fetches a person when: </span>
                        {role.escalationRule.replace(/^Escalate\s+(immediately\s+)?if\s+/i, "")}
                      </p>
                    ) : null}
                    <Button asChild size="sm" className="mt-6 self-start">
                      <Link href={`${SHOWCASE.cta.href}?template=${role.id}`}>
                        {SHOWCASE.cta.label}
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </div>

                  {/* The same cushion the landing page's product frames sit on. */}
                  <div className="mat rounded-panel p-3 sm:p-4">
                    <div className="h-full rounded-lg border border-line bg-surface p-4 sm:p-5">
                      <p className="eyebrow">{SHOWCASE.exampleLabel}</p>
                      <div className="mt-3 space-y-3 text-base leading-relaxed">
                        <p className="ml-auto max-w-[85%] rounded-panel rounded-br-md bg-accent px-4 py-2.5 text-accent-fg">
                          {role.example.prompt}
                        </p>
                        <p className="max-w-[92%] rounded-panel rounded-tl-md border border-line bg-paper px-4 py-2.5 text-ink">
                          {role.example.response}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>

      {/* The same closing call the landing page makes, so the catalogue ends
          somewhere rather than just stopping. */}
      <section className="sky relative overflow-hidden">
        <div className="sun left-[12%] top-[58%] hidden sm:block" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-20 text-center sm:px-6 sm:pb-40 sm:pt-24">
          <h2 className="mx-auto max-w-3xl font-display text-title text-balance text-[var(--sky-ink)]">
            {LANDING.cta.heading}
          </h2>
          <p className="mt-5 text-lg font-medium text-[var(--sky-ink)]">{LANDING.cta.body}</p>
          <Link href={LANDING.cta.button.href} className={`${GLASS_BUTTON} mt-8`}>
            {LANDING.cta.button.label}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
