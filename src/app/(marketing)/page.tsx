import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Aurora, Bento, Marquee } from "@/components/marketing/landing-blocks";
import { HeroStage } from "@/components/marketing/hero-stage";
import { CountUp, Parallax, Reveal } from "@/components/marketing/reveal";
import { LANDING, SITE, pageMetadata, templateById } from "@/lib/content";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: `${SITE.company.name} — ${LANDING.meta.title}`,
  description: LANDING.meta.description,
  path: "/",
  absoluteTitle: true,
});

/** Splits the headline around the words that get the gradient. */
function headlineParts(headline: string, highlight: string) {
  const at = highlight ? headline.indexOf(highlight) : -1;
  if (at === -1) return { before: headline, mark: "", after: "" };
  return {
    before: headline.slice(0, at),
    mark: highlight,
    after: headline.slice(at + highlight.length),
  };
}

/** The primary call to action on the dark stage: white, with the glow behind it. */
const STAGE_BUTTON = cn(
  "lift inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold",
  "bg-[var(--stage-ink)] text-[var(--stage)] shadow-[0_0_48px_-10px_var(--glow)]",
  "hover:shadow-[0_0_64px_-8px_var(--glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-text-a)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--stage)]",
  "[&_svg]:size-[1.125rem]",
);
const STAGE_BUTTON_SECONDARY = cn(
  "lift inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-medium",
  "border border-[var(--stage-line)] text-[var(--stage-ink)] hover:border-[var(--stage-muted)] hover:bg-[var(--stage-surface)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--glow-text-a)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--stage)]",
);

/**
 * The front door. A signed-in person has already been convinced; they go to
 * their workspace. Everyone else gets the pitch: one headline, one line, the
 * product moving, and the rest of the page revealing itself as they scroll.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await currentUser();
  if (user) {
    const project = await defaultProject(user.id);
    // A role chosen on the showcase goes straight into the hire wizard.
    const { template } = await searchParams;
    if (template && templateById(template)) {
      redirect(`/p/${project.slug}/agents/new?template=${encodeURIComponent(template)}`);
    }
    redirect(`/p/${project.slug}/roster`);
  }

  const { hero, stats, ticker, howItWorks, bento, pricing, cta } = LANDING;
  const { before, mark, after } = headlineParts(hero.headline, hero.highlight);

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="stage relative overflow-hidden">
        <Parallax className="absolute inset-0" distance={160}>
          <Aurora />
        </Parallax>
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--glow-text-a)]">{hero.eyebrow}</p>
          <h1 className="mt-5 max-w-5xl font-display text-hero text-balance text-[var(--stage-ink)]">
            {before}
            {mark ? <span className="glow-text">{mark}</span> : null}
            {after}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--stage-muted)] sm:text-xl sm:leading-snug">
            {hero.subhead}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={hero.primaryCta.href} className={STAGE_BUTTON}>
              {hero.primaryCta.label}
              <ArrowRight aria-hidden />
            </Link>
            <Link href={hero.secondaryCta.href} className={STAGE_BUTTON_SECONDARY}>
              {hero.secondaryCta.label}
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--stage-muted)]">{hero.note}</p>

          <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
            <dl className="flex flex-wrap gap-x-12 gap-y-6 lg:flex-col lg:gap-y-8">
              {stats.map((item) => (
                <div key={item.label} className="min-w-[8rem]">
                  <dd className="whitespace-nowrap font-display text-display font-semibold tracking-tight text-[var(--stage-ink)]">
                    <CountUp value={item.value} suffix={item.suffix} />
                  </dd>
                  <dt className="mt-1 text-sm text-[var(--stage-muted)]">{item.label}</dt>
                </div>
              ))}
            </dl>
            <HeroStage />
          </div>
        </div>
      </section>

      <Marquee label={ticker.label} items={ticker.items} />

      {/* How it works -------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="max-w-2xl font-display text-display font-semibold tracking-tight text-ink">
              {howItWorks.heading}
            </h2>
            <p className="mt-3 text-lg text-ink-muted">{howItWorks.intro}</p>
          </Reveal>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {howItWorks.steps.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={index * 0.12} className="h-full">
                  <div className="lift h-full rounded-panel border border-line bg-surface p-6 hover:border-accent-line hover:shadow-md">
                    <span className="font-display text-xl font-semibold text-accent">0{index + 1}</span>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Bento --------------------------------------------------------- */}
      <section className="border-t border-line bg-surface-2/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="max-w-2xl font-display text-display font-semibold tracking-tight text-ink">
              {bento.heading}
            </h2>
            <p className="mt-3 text-lg text-ink-muted">{bento.intro}</p>
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <Bento cards={bento.cards} />
          </Reveal>
        </div>
      </section>

      {/* Pricing ------------------------------------------------------- */}
      <section id="pricing" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="max-w-2xl font-display text-display font-semibold tracking-tight text-ink">
              {pricing.heading}
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-ink-muted">{pricing.intro}</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan, index) => (
              <Reveal key={plan.id} delay={index * 0.12} className="h-full">
                <Panel
                  className={cn(
                    "lift flex h-full flex-col p-6 hover:shadow-md",
                    plan.id === "starter" && "border-accent-line ring-1 ring-accent-line",
                  )}
                >
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{plan.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{plan.blurb}</p>
                  <p className="mt-5 font-display text-display font-semibold tracking-tight text-ink">
                    ${plan.priceUsd}
                    <span className="font-sans text-sm font-normal tracking-normal text-ink-muted"> / month</span>
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                    <li>{plan.limits.publishedAgents} published agent{plan.limits.publishedAgents === 1 ? "" : "s"}</li>
                    <li>{plan.limits.actionItemsPerMonth.toLocaleString()} autonomous runs a month</li>
                    <li>{plan.limits.conversationsPerMonth.toLocaleString()} client conversations a month</li>
                    <li>${plan.limits.modelCostUsdPerMonth} model budget included</li>
                  </ul>
                  <Button asChild className="lift mt-6 w-full" variant={plan.id === "starter" ? "primary" : "secondary"}>
                    <Link href="/signup">{plan.priceUsd === 0 ? "Start free" : `Start with ${plan.name}`}</Link>
                  </Button>
                </Panel>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-sm text-ink-subtle">{pricing.footnote}</p>
        </div>
      </section>

      {/* CTA ----------------------------------------------------------- */}
      <section className="stage relative overflow-hidden">
        <Aurora />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-hero text-balance text-[var(--stage-ink)]">
              {cta.heading}
            </h2>
            <p className="mt-5 text-lg text-[var(--stage-muted)]">{cta.body}</p>
            <Link href={cta.button.href} className={cn(STAGE_BUTTON, "mt-9")}>
              {cta.button.label}
              <ArrowRight aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
