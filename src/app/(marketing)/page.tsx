import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { LANDING, SITE, TEMPLATES, absoluteUrl } from "@/lib/content";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: { absolute: `${SITE.company.name} — ${LANDING.meta.title}` },
  description: LANDING.meta.description,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: `${SITE.company.name} — ${LANDING.meta.title}`,
    description: LANDING.meta.description,
    url: absoluteUrl("/"),
    siteName: SITE.company.name,
    type: "website",
  },
};

/**
 * The front door. A signed-in person has already been convinced; they go to
 * their workspace. Everyone else gets the pitch.
 */
export default async function LandingPage() {
  const user = await currentUser();
  if (user) {
    const project = await defaultProject(user.id);
    redirect(`/p/${project.slug}/roster`);
  }

  const { hero, proof, howItWorks, trust, pricing, cta } = LANDING;
  const roles = TEMPLATES.slice(0, 6);

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="paper-grid">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-accent">{hero.eyebrow}</p>
            <h1 className="mt-3 text-display font-semibold leading-[1.1] tracking-tight text-ink sm:text-display">
              {hero.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">{hero.subhead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={hero.primaryCta.href}>
                  {hero.primaryCta.label}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-subtle">{hero.note}</p>
          </div>
          <dl className="mt-14 grid gap-4 sm:grid-cols-3">
            {proof.map((item) => (
              <div key={item.label} className="rounded-panel border border-line bg-surface px-5 py-4">
                <dt className="text-sm text-ink-muted">{item.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works -------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{howItWorks.heading}</h2>
          <p className="mt-2 text-ink-muted">{howItWorks.intro}</p>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {howItWorks.steps.map((step, index) => (
              <li key={step.title} className="rounded-panel border border-line bg-surface p-6">
                <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-sm font-semibold text-accent-soft-fg">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles preview ------------------------------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">Roles you can hire</h2>
              <p className="mt-2 text-ink-muted">Each one is a template: a job, a voice, a rule for when to fetch a human.</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/showcase">
                All roles
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <li key={role.id}>
                <Link
                  href={`/showcase#${role.id}`}
                  className="flex h-full flex-col rounded-panel border border-line bg-paper p-5 transition-colors hover:border-accent-line hover:bg-accent-soft/20"
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent-soft-fg">
                    <TemplateIcon icon={role.icon} className="size-4" />
                  </span>
                  <span className="mt-4 text-base font-semibold text-ink">{role.name}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-ink-muted">{role.pitch}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust --------------------------------------------------------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{trust.heading}</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {trust.points.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{point.title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-ink-muted">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing ------------------------------------------------------- */}
      <section id="pricing" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{pricing.heading}</h2>
          <p className="mt-2 max-w-2xl text-ink-muted">{pricing.intro}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan) => (
              <Panel key={plan.id} className={`p-6 ${plan.id === "starter" ? "border-accent-line ring-1 ring-accent-line" : ""}`}>
                <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{plan.blurb}</p>
                <p className="mt-4 text-xl font-semibold tracking-tight text-ink">
                  ${plan.priceUsd}
                  <span className="text-sm font-normal text-ink-muted"> / month</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                  <li>{plan.limits.publishedAgents} published agent{plan.limits.publishedAgents === 1 ? "" : "s"}</li>
                  <li>{plan.limits.actionItemsPerMonth.toLocaleString()} autonomous runs a month</li>
                  <li>{plan.limits.conversationsPerMonth.toLocaleString()} client conversations a month</li>
                  <li>${plan.limits.modelCostUsdPerMonth} model budget included</li>
                </ul>
                <Button asChild className="mt-6 w-full" variant={plan.id === "starter" ? "primary" : "secondary"}>
                  <Link href="/signup">{plan.priceUsd === 0 ? "Start free" : `Start with ${plan.name}`}</Link>
                </Button>
              </Panel>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-subtle">{pricing.footnote}</p>
        </div>
      </section>

      {/* CTA ----------------------------------------------------------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{cta.heading}</h2>
          <p className="mt-2 text-ink-muted">{cta.body}</p>
          <Button asChild size="lg" className="mt-6">
            <Link href={cta.button.href}>
              {cta.button.label}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
