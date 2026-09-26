import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hasCoreContext } from "@/lib/work/context";
import { ArrowRight, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import {
  AuditTrail,
  ComparisonTable,
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
import { Dunes, NightSky } from "@/components/marketing/night-sky";
import { HeroSnap } from "@/components/marketing/hero-snap";
import { LinkButton } from "@/components/marketing/link-button";
import { HeroWords } from "@/components/marketing/words";
import { Section, SectionHeader } from "@/components/marketing/section";
import { ShowcaseBento } from "@/components/marketing/showcase-bento";
import { Reveal } from "@/components/marketing/reveal";
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
    const picked = template && templateById(template) ? template : null;
    // A brand-new workspace starts by describing the business, then hires.
    if (!hasCoreContext(project) && (await prisma.agent.count({ where: { projectId: project.id } })) === 0) {
      redirect(`/p/${project.slug}/welcome${picked ? `?template=${encodeURIComponent(picked)}` : ""}`);
    }
    if (picked) {
      redirect(`/p/${project.slug}/agents/new?template=${encodeURIComponent(picked)}`);
    }
    redirect(`/p/${project.slug}/roster`);
  }

  const { hero, trustStrip, steps, features, trust, roles, comparison, metrics, testimonials, pricing, faq, cta } =
    LANDING;
  // Placeholders are for review only: outside production an unmeasured number
  // shows as a marked TODO; in production the section waits for real values.
  const showMetrics = metricsReady(metrics.items) || process.env.NODE_ENV !== "production";
  const showTestimonials = testimonials.enabled && testimonials.items.length > 0;

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      {/* overflow-x-clip, not overflow-hidden: the stage hangs below the sky
          on purpose (-mb below), and hidden cut its foot off; clip is also
          what lets the stage stick. The sky and dunes are clipped by their
          own boxes. */}
      <section className="sky relative -mt-14 overflow-x-clip pt-14" data-header-clear>
        <NightSky uid="hero-sky" />
        {/* The dunes crest just above the first screen's fold, whatever the
            hero's length - the hold makes it long - at a fixed height, since
            a share of the section would blow them up past the crest. Below
            them the sand falls into shadow for the stretch the window is
            pinned over, then the whole hero dissolves into the paper. */}
        <div className="absolute inset-x-0 top-[calc(100svh-16rem)] h-[36rem] sm:h-[40rem]">
          <Dunes uid="hero-dunes" />
        </div>
        <div
          aria-hidden
          className="hero-dissolve absolute inset-x-0 bottom-0 top-[calc(100svh-4rem)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-24 text-center sm:px-6 sm:pb-14 sm:pt-36">
          {/* hero-copy rises and fades as the window rises, gone by the time
              it pins, so nothing is left under the clear header. */}
          <div className="hero-copy">
          <h1 className="mx-auto max-w-4xl font-display text-hero text-balance text-[var(--sky-ink)]">
            <HeroWords text={hero.headline} />
          </h1>
          <p className="hero-in mx-auto mt-5 max-w-2xl text-lg font-medium leading-relaxed text-pretty text-[var(--sky-ink)] [--in:4] sm:text-xl sm:leading-snug">
            {hero.subhead}
          </p>
          <div className="hero-in mt-7 flex flex-wrap items-center justify-center gap-4 [--in:5]">
            <Link href={hero.primaryCta.href} className={GLASS_BUTTON}>
              {hero.primaryCta.label}
              <ArrowRight aria-hidden />
            </Link>
            <Link href={hero.secondaryCta.href} className={SKY_LINK}>
              {hero.secondaryCta.label}
            </Link>
          </div>
          <p className="hero-in mt-4 text-sm font-medium text-[var(--sky-ink)] [--in:6]">{hero.microcopy}</p>
          </div>

          {/* The product, floating over the horizon and down into the page.
              stage-rise tilts it back at the top of the page and scrolling
              stands it up; it pins in the middle of the screen, holds there
              for a stretch of scroll while the reel plays, then the page
              moves on. HeroSnap finishes a scroll that stops on the way, so
              the window lands whole (globals.css, "The hero's stage"). */}
          <div className="stage-track relative z-10 mx-auto mt-10 max-w-4xl [perspective:1600px] sm:mt-12">
            <HeroStage data-header-solid className="stage-rise stage-pin text-left" />
            <div className="stage-hold" aria-hidden />
          </div>
        </div>
        <HeroSnap />
      </section>

      {/* Built on ------------------------------------------------------- */}
      <Section containerClassName="py-8 sm:py-10">
        <TrustStrip label={trustStrip.label} items={trustStrip.items} />
      </Section>

      {/* How it works ----------------------------------------------------- */}
      <Section id="how-it-works" labelledBy="steps-heading" containerClassName="pt-2 sm:pt-4">
        <SectionHeader id="steps-heading" eyebrow={steps.eyebrow} heading={steps.heading} intro={steps.intro} />
        <div className="mt-14">
          <Steps items={steps.items} />
        </div>
      </Section>

      {/* Showcase ---------------------------------------------------------- */}
      <Section id="product" labelledBy="product-heading" className="sky-wash border-t border-line">
          <SectionHeader
            id="product-heading"
            eyebrow={features.eyebrow}
            heading={features.heading}
            intro={features.intro}
          />
        <div className="mt-12">
          <ShowcaseBento items={features.items} />
        </div>
      </Section>

      {/* Trust & control ---------------------------------------------------- */}
      <Section id="trust" labelledBy="trust-heading" className="bg-accent text-accent-fg">
        <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
            <SectionHeader
              id="trust-heading"
              align="left"
              tone="inverse"
              eyebrow={trust.eyebrow}
              heading={trust.heading}
              intro={trust.intro}
            />
          <AuditTrail />
        </div>
        <div className="mt-12">
          <TrustGrid items={trust.items} />
        </div>
      </Section>

      {/* Roles ------------------------------------------------------------- */}
      <Section id="roles" labelledBy="roles-heading">
        <SectionHeader id="roles-heading" eyebrow={roles.eyebrow} heading={roles.heading} intro={roles.intro} />
        <div className="mt-12">
          <RoleGrid cta={roles.cta} />
        </div>
      </Section>

      {/* Comparison: Desker vs Generic AI ---------------------------------- */}
      {comparison ? (
        <Section id="comparison" labelledBy="comparison-heading" className="border-t border-line bg-surface">
          <SectionHeader
            id="comparison-heading"
            eyebrow={comparison.eyebrow}
            heading={comparison.heading}
            intro={comparison.intro}
          />
          <div className="mt-12">
            <ComparisonTable
              competitorLabel={comparison.competitorLabel}
              deskerLabel={comparison.deskerLabel}
              items={comparison.items}
            />
          </div>
        </Section>
      ) : null}

      {/* Outcomes ---------------------------------------------------------- */}
      {showMetrics ? (
        <Section labelledBy="metrics-heading" className="border-t border-line bg-surface">
            <SectionHeader id="metrics-heading" eyebrow={metrics.eyebrow} heading={metrics.heading} intro={metrics.intro} />
          <div className="mt-12">
            <MetricTiles items={metrics.items} />
          </div>
        </Section>
      ) : null}

      {/* Testimonials: real quotes only, off until content enables them --- */}
      {showTestimonials ? (
        <Section labelledBy="testimonials-heading" className="border-t border-line">
            <SectionHeader
              id="testimonials-heading"
              eyebrow={testimonials.eyebrow}
              heading={testimonials.heading}
              intro={testimonials.intro}
            />
          <div className="mt-12">
            <Testimonials items={testimonials.items} />
          </div>
        </Section>
      ) : null}

      {/* Pricing ------------------------------------------------------------ */}
      <Section id="pricing" labelledBy="pricing-heading" className="border-t border-line">
          <SectionHeader id="pricing-heading" eyebrow={pricing.eyebrow} heading={pricing.heading} intro={pricing.intro} />
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
                  <LinkButton href="/signup" className="mt-auto min-h-[44px] w-full" variant={popular ? "primary" : "secondary"}>
                    {plan.priceUsd === 0 ? "Start free" : `Start with ${plan.name}`}
                  </LinkButton>
                </Panel>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-ink-muted">{pricing.footnote}</p>
        <p className="mt-2 text-center text-sm text-ink-muted">{pricing.reassurance}</p>
      </Section>

      {/* FAQ ---------------------------------------------------------------- */}
      <Section id="faq" labelledBy="faq-heading" className="border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <SectionHeader id="faq-heading" align="left" eyebrow={faq.eyebrow} heading={faq.heading} intro={faq.intro} />
          <Faq items={faq.items} />
        </div>
      </Section>

      {/* CTA ---------------------------------------------------------------- */}
      {/* The page's bookend: it opens on the night sky and closes on it. The
          sand runs to the bottom edge and settles into shadow rather than
          fading to paper - a wash of near-white directly above a white footer
          read as a printing fault rather than as a horizon. */}
      <section className="sky relative overflow-hidden">
        <NightSky uid="cta-sky" />
        {/* Masked at the top so the sand rises out of the night instead of
            starting on a ruled line across the width of the page, and mirrored
            so the closing band is the other side of the same landscape rather
            than a repeat of the hero's. */}
        <div
          className="absolute inset-x-0 bottom-0 h-[46%] -scale-x-100 [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
        >
          <Dunes uid="cta-dunes" haze={false} />
        </div>
        {/* Night falling down the slope: the crest keeps the last of the light
            and everything below it goes to shadow, so the sand reads as a
            horizon rather than as a flat blue panel above the footer. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[46%] bg-linear-to-b from-transparent via-[var(--dune-deep)]/55 to-[var(--dune-deep)]"
        />
        {/* The last of the light along that edge. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-[var(--dune-crest)] to-transparent opacity-40"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-24 text-center sm:px-6 sm:pb-40 sm:pt-32">
          <Reveal>
            {/* A bookend, not a second hero: same serif, section scale. */}
            <h2 className="mx-auto max-w-3xl font-display text-title text-balance text-[var(--sky-ink)]">
              {cta.heading}
            </h2>
            <p className="mt-4 text-lg font-medium text-[var(--sky-ink)]">{cta.body}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href={cta.button.href} className={GLASS_BUTTON}>
                {cta.button.label}
                <ArrowRight aria-hidden />
              </Link>
              {cta.secondary ? (
                <Link href={cta.secondary.href} className={SKY_LINK}>
                  {cta.secondary.label}
                </Link>
              ) : null}
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--sky-ink)]">{cta.microcopy}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
