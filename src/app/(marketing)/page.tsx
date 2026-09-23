import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  AuditTrail,
  Faq,
  MetricTiles,
  RoleGrid,
  Steps,
  Testimonials,
  TrustGrid,
  TrustStrip,
  metricsReady,
} from "@/components/marketing/landing-blocks";
import { GLASS_BUTTON, SKY_LINK } from "@/components/marketing/glass-button";
import { HeroStage } from "@/components/marketing/hero-stage";
import { Highlight } from "@/components/marketing/highlight";
import { Dunes, NightSky } from "@/components/marketing/night-sky";
import { Section, SectionHeader } from "@/components/marketing/section";
import { ShowcaseBento } from "@/components/marketing/showcase-bento";
import { Parallax, Reveal } from "@/components/marketing/reveal";
import { LANDING, SITE, pageMetadata, templateById } from "@/lib/content";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: `${SITE.company.name} — ${LANDING.meta.title}`,
  description: LANDING.meta.description,
  path: "/",
  absoluteTitle: true,
});

/**
 * The front door, in the order a visitor's questions arrive: what is it
 * (hero), can I believe it (built on), why would I (problem), how (three
 * steps), what exactly (showcase), is it safe (trust), which one (roles),
 * does it work (outcomes, quotes), what does it cost (pricing), but what
 * about (FAQ), and go (CTA).
 *
 * A signed-in person has already been convinced; they go to their workspace.
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

  const { hero, trustStrip, problem, steps, features, trust, roles, metrics, testimonials, pricing, faq, cta } =
    LANDING;
  // Placeholders are for review only: outside production an unmeasured number
  // shows as a marked TODO; in production the section waits for real values.
  const showMetrics = metricsReady(metrics.items) || process.env.NODE_ENV !== "production";
  const showTestimonials = testimonials.enabled && testimonials.items.length > 0;

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      {/* overflow-x-clip, not overflow-hidden: the stage hangs below the sky
          on purpose (-mb below), and hidden cut its foot off. The sky and
          dunes are clipped by their own boxes. */}
      <section className="sky relative -mt-14 overflow-x-clip pt-14" data-header-clear>
        <NightSky uid="hero-sky" />
        {/* A fixed height, not a share of the section: the pinned demo makes
            the hero tall, and a percentage would blow the dunes up past the
            crest. */}
        <Parallax className="absolute inset-x-0 bottom-0 h-[36rem] sm:h-[40rem]" distance={-40}>
          <Dunes uid="hero-dunes" />
        </Parallax>
        {/* The dunes are cropped to fit (slice), so their last row can be
            sand rather than their own paper haze; this lands the edge on paper. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-paper" />

        <div className="relative mx-auto max-w-6xl px-4 pt-24 text-center sm:px-6 sm:pt-36">
          <Reveal>
            <h1 className="mx-auto max-w-4xl font-display text-hero text-balance text-[var(--sky-ink)]">
              {hero.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-relaxed text-pretty text-[var(--sky-ink)] sm:text-xl sm:leading-snug">
              {hero.subhead}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Link href={hero.primaryCta.href} className={GLASS_BUTTON}>
                {hero.primaryCta.label}
                <ArrowRight aria-hidden />
              </Link>
              <Link href={hero.secondaryCta.href} className={SKY_LINK}>
                {hero.secondaryCta.label}
              </Link>
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--sky-ink)]">{hero.microcopy}</p>
          </Reveal>

          {/* The product, floating over the horizon and down into the page.
              stage-rise tilts it back at the top of the page and scrolling
              stands it up toward the reader; the track then holds it pinned
              under the header for a stretch of scroll while the reel plays,
              before the page moves on (globals.css). */}
          <div className="stage-track relative z-10 mx-auto -mb-24 mt-12 max-w-4xl [perspective:1600px] sm:-mb-32 sm:mt-16">
            <HeroStage data-header-solid className="stage-rise stage-pin text-left" />
            <div className="stage-hold" aria-hidden />
          </div>
        </div>
      </section>

      {/* Built on ------------------------------------------------------- */}
      {/* Top padding clears the stage that hangs down from the hero. */}
      <Section containerClassName="pb-0 pt-32 sm:pb-0 sm:pt-44">
        <Reveal>
          <TrustStrip label={trustStrip.label} items={trustStrip.items} />
        </Reveal>
      </Section>

      {/* Problem -> promise -------------------------------------------- */}
      <Section labelledBy="problem-heading">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-accent">{problem.eyebrow}</p>
          <div className="mt-5 space-y-3">
            {problem.pains.map((pain) => (
              <p key={pain} className="text-xl leading-snug text-pretty text-ink-muted">
                {pain}
              </p>
            ))}
          </div>
          <h2 id="problem-heading" className="mt-8 text-title text-balance text-ink">
            <Highlight text={problem.promise} phrase={problem.highlight} />
          </h2>
        </Reveal>
      </Section>

      {/* How it works ----------------------------------------------------- */}
      <Section id="how-it-works" labelledBy="steps-heading" className="border-t border-line bg-surface">
        <Reveal>
          <SectionHeader id="steps-heading" eyebrow={steps.eyebrow} heading={steps.heading} intro={steps.intro} />
        </Reveal>
        <Reveal className="mt-14" delay={0.1}>
          <Steps items={steps.items} />
        </Reveal>
      </Section>

      {/* Showcase ---------------------------------------------------------- */}
      <Section id="product" labelledBy="product-heading" className="sky-wash border-t border-line">
        <Reveal>
          <SectionHeader
            id="product-heading"
            eyebrow={features.eyebrow}
            heading={features.heading}
            intro={features.intro}
          />
        </Reveal>
        <Reveal className="mt-12" delay={0.1}>
          <ShowcaseBento items={features.items} />
        </Reveal>
      </Section>

      {/* Trust & control ---------------------------------------------------- */}
      <Section id="trust" labelledBy="trust-heading" className="bg-accent text-accent-fg">
        <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <SectionHeader
              id="trust-heading"
              align="left"
              tone="inverse"
              eyebrow={trust.eyebrow}
              heading={trust.heading}
              intro={trust.intro}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <AuditTrail />
          </Reveal>
        </div>
        <Reveal className="mt-12" delay={0.15}>
          <TrustGrid items={trust.items} />
        </Reveal>
      </Section>

      {/* Roles ------------------------------------------------------------- */}
      <Section id="roles" labelledBy="roles-heading">
        <Reveal>
          <SectionHeader id="roles-heading" eyebrow={roles.eyebrow} heading={roles.heading} intro={roles.intro} />
        </Reveal>
        <Reveal className="mt-12" delay={0.1}>
          <RoleGrid cta={roles.cta} />
        </Reveal>
      </Section>

      {/* Outcomes ---------------------------------------------------------- */}
      {showMetrics ? (
        <Section labelledBy="metrics-heading" className="border-t border-line bg-surface">
          <Reveal>
            <SectionHeader id="metrics-heading" eyebrow={metrics.eyebrow} heading={metrics.heading} intro={metrics.intro} />
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <MetricTiles items={metrics.items} />
          </Reveal>
        </Section>
      ) : null}

      {/* Testimonials: real quotes only, off until content enables them --- */}
      {showTestimonials ? (
        <Section labelledBy="testimonials-heading" className="border-t border-line">
          <Reveal>
            <SectionHeader
              id="testimonials-heading"
              eyebrow={testimonials.eyebrow}
              heading={testimonials.heading}
              intro={testimonials.intro}
            />
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <Testimonials items={testimonials.items} />
          </Reveal>
        </Section>
      ) : null}

      {/* Pricing ------------------------------------------------------------ */}
      <Section id="pricing" labelledBy="pricing-heading" className="border-t border-line">
        <Reveal>
          <SectionHeader id="pricing-heading" eyebrow={pricing.eyebrow} heading={pricing.heading} intro={pricing.intro} />
        </Reveal>
        {/* Three columns only from lg. At 768 they were 230px wide and every
            feature line wrapped twice; below that it is one readable column. */}
        <div className="mx-auto mt-12 grid max-w-md items-stretch gap-4 lg:max-w-5xl lg:grid-cols-3">
          {Object.values(PLANS).map((plan, index) => {
            const popular = plan.id === pricing.popularPlan;
            return (
              <Reveal
                key={plan.id}
                delay={index * 0.08}
                // Proud of its neighbours at the top only, so its call still
                // lands on the same line as the other two.
                className={cn("h-full", popular && "lg:-mt-4 lg:h-[calc(100%+1rem)]")}
              >
                <Panel
                  className={cn(
                    "lift relative flex h-full flex-col p-6 hover:shadow-md",
                    popular ? "border-accent-line shadow-sm ring-2 ring-accent-line" : "hover:border-accent-line",
                  )}
                >
                  {popular ? (
                    <Badge tone="accent" className="absolute -top-2.5 left-6 shadow-xs">
                      {pricing.popularLabel}
                    </Badge>
                  ) : null}
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-ink-muted">{plan.blurb}</p>
                  <p className="mt-5 text-display font-medium tracking-tight text-ink">
                    ${plan.priceUsd}
                    <span className="text-sm font-normal tracking-normal text-ink-muted"> / month</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-ink-muted">
                    {[
                      `${plan.limits.publishedAgents} published agent${plan.limits.publishedAgents === 1 ? "" : "s"}`,
                      `${plan.limits.actionItemsPerMonth.toLocaleString("en-US")} autonomous runs a month`,
                      `${plan.limits.conversationsPerMonth.toLocaleString("en-US")} client conversations a month`,
                      `$${plan.limits.modelCostUsdPerMonth} model budget included`,
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-auto min-h-[44px] w-full" variant={popular ? "primary" : "secondary"}>
                    <Link href="/signup">{plan.priceUsd === 0 ? "Start free" : `Start with ${plan.name}`}</Link>
                  </Button>
                </Panel>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-ink-muted">{pricing.footnote}</p>
      </Section>

      {/* FAQ ---------------------------------------------------------------- */}
      <Section id="faq" labelledBy="faq-heading" className="border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <SectionHeader id="faq-heading" align="left" eyebrow={faq.eyebrow} heading={faq.heading} intro={faq.intro} />
          </Reveal>
          <Reveal delay={0.1}>
            <Faq items={faq.items} />
          </Reveal>
        </div>
      </Section>

      {/* CTA ---------------------------------------------------------------- */}
      <section className="sky relative overflow-hidden">
        <NightSky uid="cta-sky" />
        <div className="absolute inset-x-0 bottom-0 h-[45%]">
          <Dunes uid="cta-dunes" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-24 text-center sm:px-6 sm:pb-56 sm:pt-32">
          <Reveal>
            {/* A bookend, not a second hero: same serif, section scale. */}
            <h2 className="mx-auto max-w-3xl font-display text-title text-balance text-[var(--sky-ink)]">
              {cta.heading}
            </h2>
            <p className="mt-4 text-lg font-medium text-[var(--sky-ink)]">{cta.body}</p>
            <Link href={cta.button.href} className={cn(GLASS_BUTTON, "mt-8")}>
              {cta.button.label}
              <ArrowRight aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
