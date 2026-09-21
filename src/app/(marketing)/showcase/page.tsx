import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { SHOWCASE, SITE, TEMPLATES, absoluteUrl } from "@/lib/content";

export const metadata: Metadata = {
  title: SHOWCASE.meta.title,
  description: SHOWCASE.meta.description,
  alternates: { canonical: absoluteUrl("/showcase") },
  openGraph: {
    title: `${SHOWCASE.meta.title} · ${SITE.company.name}`,
    description: SHOWCASE.meta.description,
    url: absoluteUrl("/showcase"),
    siteName: SITE.company.name,
    type: "website",
  },
};

/**
 * Every role, from the same records the hire wizard starts from. Adding a
 * template to content/templates.json puts it here with no other change.
 */
export default function ShowcasePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-display">{SHOWCASE.heading}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">{SHOWCASE.intro}</p>
      </div>

      <ol className="mt-12 space-y-6">
        {TEMPLATES.map((role) => (
          <li
            key={role.id}
            id={role.id}
            className="scroll-mt-20 grid gap-6 rounded-panel border border-line bg-surface p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8"
          >
            <div>
              <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent-soft-fg">
                <TemplateIcon icon={role.icon} className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-ink">{role.name}</h2>
              <p className="mt-1 text-sm text-ink-subtle">
                {role.jobTitle}
                {role.team ? ` · ${role.team}` : ""}
              </p>
              <p className="mt-3 text-base leading-relaxed text-ink-muted">{role.pitch}</p>
              {role.escalationRule ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
                  <span className="font-medium text-ink-muted">Fetches a person when: </span>
                  {role.escalationRule.replace(/^Escalate\s+(immediately\s+)?if\s+/i, "")}
                </p>
              ) : null}
              <Button asChild size="sm" className="mt-5">
                <Link href={`${SHOWCASE.cta.href}?template=${role.id}`}>
                  {SHOWCASE.cta.label}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="rounded-lg border border-line bg-paper p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                {SHOWCASE.exampleLabel}
              </p>
              <div className="mt-3 space-y-3 text-base leading-relaxed">
                <p className="ml-auto max-w-[85%] rounded-panel rounded-br-md bg-accent px-4 py-2.5 text-accent-fg">
                  {role.example.prompt}
                </p>
                <p className="max-w-[92%] rounded-panel rounded-bl-md border border-line bg-surface px-4 py-2.5 text-ink">
                  {role.example.response}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
