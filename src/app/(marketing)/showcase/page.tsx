import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CTA_PRIMARY } from "@/components/marketing/cta";
import { SoftNotes, StickyNote } from "@/components/marketing/desk-notes";
import { PageHeader } from "@/components/marketing/page-header";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { Reveal } from "@/components/marketing/reveal";
import { RoleRun } from "@/components/marketing/role-run";

import { ROLE_STAFF as STAFF } from "@/components/marketing/landing-blocks";
import { LANDING, SHOWCASE, TEMPLATES, pageMetadata } from "@/lib/content";

/** Business roles first, then your own life's: the two groups the landing page shows. */
const GROUPS = (["business", "personal"] as const).map((audience) => ({
  audience,
  label: LANDING.roles.groups[audience],
  roles: TEMPLATES.filter((role) => role.audience === audience),
}));

export const metadata: Metadata = pageMetadata({
  title: SHOWCASE.meta.title,
  description: SHOWCASE.meta.description,
  path: "/showcase",
});

/**
 * Every role, from the same records the hire wizard starts from. Adding a
 * template to content/templates.json puts it here with no other change.
 *
 * Fourteen roles is a long page and most arrivals are deep links - every card in
 * the landing page's bento points at an anchor here - so the sky band carries
 * an index, and each role is a block of its own with the worked example in a
 * frame beside it: a real run, not a chat.
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
        <ul className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5 [mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)] sm:px-6">
          {GROUPS.flatMap((group) => group.roles).map((role) => (
            <li key={role.id}>
              <Link
                href={`#${role.id}`}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent-line hover:text-ink"
              >
                <TemplateIcon icon={role.icon} className="size-4" />
                {role.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl space-y-16 px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-16">
        {GROUPS.map((group) => (
          <section key={group.audience} aria-labelledby={`group-${group.audience}`}>
            <h2 id={`group-${group.audience}`} className="mb-6 font-hand text-hand-title text-ink">
              {group.label}
            </h2>
            <ol className="space-y-6">
              {group.roles.map((role) => {
                const [agent, seed] = STAFF[role.id] ?? ["Your agent", role.id];
                const where = role.audience === "personal" ? "Maya · Personal" : "ABC Inc.";
                return (
                  <li key={role.id} id={role.id} className="scroll-mt-32">
                    <Reveal>
                      <div className="grid gap-6 rounded-panel border border-line bg-surface p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8">
                        <div className="flex flex-col">
                          <span className="flex size-12 items-center justify-center rounded-panel bg-accent-soft text-accent-soft-fg shadow-xs">
                            <TemplateIcon icon={role.icon} className="size-6" />
                          </span>
                          <h3 className="mt-4 text-xl font-bold tracking-tight text-ink">{role.name}</h3>
                          <p className="mt-1 text-sm text-ink-muted">
                            {role.jobTitle}
                            {role.team ? ` · ${role.team}` : ""}
                          </p>
                          <p className="mt-3 text-base leading-relaxed text-ink-muted">{role.pitch}</p>
                          {role.escalationRule ? (
                            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                              <span className="font-medium text-ink">
                                {role.audience === "personal" ? "Asks you first when: " : "Fetches a person when: "}
                              </span>
                              {role.escalationRule.replace(/^Escalate\s+(immediately\s+)?(if|before)\s+/i, "")}
                            </p>
                          ) : null}
                          <Link href={SHOWCASE.cta.href} className={`${CTA_PRIMARY} mt-6 self-start`}>
                            {SHOWCASE.cta.label}
                            <ArrowRight aria-hidden />
                          </Link>
                        </div>

                        {/* A real run, played like the landing page's demo. */}
                        <div className="mat min-w-0 rounded-panel p-3 sm:p-4">
                          <RoleRun
                            roleId={role.id}
                            agent={agent}
                            seed={seed}
                            work={role.work}
                            place={`${where} · ${agent} · ${role.work.trigger}`}
                          />
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {/* The same closing call the landing page makes, so the catalogue ends
          somewhere rather than just stopping. */}
      <section className="relative overflow-hidden border-t border-line">
        <SoftNotes preset="cta" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <StickyNote tone="lemon" tilt={-1.5} className="relative mx-auto max-w-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 className="mx-auto max-w-xl font-hand text-hand-title text-balance">{LANDING.cta.heading}</h2>
            <p className="mt-4 text-lg">{LANDING.cta.body}</p>
            <Link href={LANDING.cta.button.href} className={`${CTA_PRIMARY} mt-8`}>
              {LANDING.cta.button.label}
              <ArrowRight aria-hidden />
            </Link>
          </StickyNote>
        </div>
      </section>
    </>
  );
}
