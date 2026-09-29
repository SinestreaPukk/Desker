import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hasCoreContext } from "@/lib/work/context";
import { spaceKind } from "@/lib/space";
import { ArrowRight, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject, projectsVisibleTo } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import {
  ComparisonTable,
  Desks,
  Faq,
  ProductShotImage,
  RoleGrid,
  Steps,
  Testimonials,
  TrustGrid,
  TrustShots,
  TrustStrip,
} from "@/components/marketing/landing-blocks";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/components/marketing/cta";
import { HeroNotes, PhoneNote, SoftNotes, StickyNote } from "@/components/marketing/desk-notes";
import { AgentAvatar } from "@/components/ui/avatar";

/** The staff in the hero's reel, by the seeds that draw their faces there: three at work, two at home. */
const HERO_STAFF = [
  ["Sol", "sol"],
  ["Nova", "nova"],
  ["Mia", "mia"],
  ["Penny", "penny"],
  ["Juno", "juno"],
] as const;
import { BrandMark } from "@/components/brand-logo";
import { HeroStage } from "@/components/marketing/hero-stage";
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
 * (hero), can I believe it (built on), who is it for (two desks: a business,
 * your own life, or both), how (three steps), what exactly (showcase), is it safe (trust), which one (roles),
 * does it work (quotes), what does it cost (pricing), but what
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
    // A role chosen on the showcase goes straight into the hire wizard - of
    // the space it belongs to, when the account has both kinds.
    const { template } = await searchParams;
    const role = template ? templateById(template) : undefined;
    const picked = role ? role.id : null;
    const project =
      (role
        ? await prisma.project.findFirst({
            where: { ...projectsVisibleTo(user.id), organization: { kind: role.audience } },
            orderBy: { createdAt: "asc" },
            include: { organization: { select: { kind: true } } },
          })
        : null) ?? (await defaultProject(user.id));
    // A brand-new space starts by describing the business (or the person), then hires.
    if (!hasCoreContext(project, spaceKind(project.organization.kind)) && (await prisma.agent.count({ where: { projectId: project.id } })) === 0) {
      redirect(`/p/${project.slug}/welcome${picked ? `?template=${encodeURIComponent(picked)}` : ""}`);
    }
    if (picked) {
      redirect(`/p/${project.slug}/agents/new?template=${encodeURIComponent(picked)}`);
    }
    redirect(`/p/${project.slug}/roster`);
  }

  const { hero, trustStrip, desks, steps, features, trust, roles, comparison, testimonials, pricing, faq, cta } =
    LANDING;
  // Placeholders are for review only: outside production an unmeasured number
  // shows as a marked TODO; in production the section waits for real values.
  const showTestimonials = testimonials.enabled && testimonials.items.length > 0;

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      {/* Split, not centred: the promise on the left in the hand, and on the
          right the product itself, working, with two of the staff's notes
          stuck to its corners. The soft notes run up behind the header. */}
      <section className="relative -mt-14 overflow-x-clip pt-14">
        <SoftNotes preset="hero" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 lg:pb-28 lg:pt-20 xl:px-10">
          <div className="min-w-0">
            <h1 className="max-w-xl font-hand text-hand-hero text-balance text-ink">
              <HeroWords text={hero.headline} highlight={[8, 11]} />
            </h1>
            <p className="hero-in mt-6 max-w-lg text-lg leading-relaxed text-pretty text-ink-muted [--in:4]">
              {hero.subhead}
            </p>
            <div className="hero-in mt-8 flex flex-wrap items-center gap-3 [--in:5]">
              <Link href={hero.primaryCta.href} className={CTA_PRIMARY}>
                {hero.primaryCta.label}
                <ArrowRight aria-hidden />
              </Link>
              <Link href={hero.secondaryCta.href} className={CTA_SECONDARY}>
                {hero.secondaryCta.label}
              </Link>
            </div>
            {/* Who you would be hiring: the five in the demo, by name. */}
            <div className="hero-in mt-8 flex items-center gap-3 [--in:6]">
              <span className="flex -space-x-2" aria-hidden>
                {HERO_STAFF.map(([name, seed]) => (
                  <AgentAvatar key={name} name={name} seed={seed} size="md" className="ring-2 ring-paper" />
                ))}
              </span>
              <p className="text-sm leading-snug text-ink-muted">
                <span className="font-semibold text-ink">Sol, Nova and Mia</span> at work ·{" "}
                <span className="font-semibold text-ink">Penny and Juno</span> at home
              </p>
            </div>
          </div>

          {/* The product, working: the reel, with two notes taped on. */}
          <div className="relative mx-auto w-full min-w-0 max-w-2xl lg:max-w-none">
            <PhoneNote />
            <HeroNotes />
            <HeroStage className="relative text-left" />
          </div>
        </div>
      </section>

      {/* Built on ------------------------------------------------------- */}
      <Section containerClassName="py-8 sm:py-10">
        <TrustStrip label={trustStrip.label} items={trustStrip.items} />
      </Section>

      {/* Two desks ------------------------------------------------------- */}
      {/* The answer to "who is it for": both, side by side, walled apart. */}
      <Section id="desks" labelledBy="desks-heading" containerClassName="pt-2 sm:pt-4">
        <SectionHeader id="desks-heading" eyebrow={desks.eyebrow} heading={desks.heading} intro={desks.intro} />
        <div className="mt-12">
          <Desks business={desks.business} personal={desks.personal} wall={desks.wall} />
        </div>
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
      {/* On a pale sky wash with its own out-of-focus notes: the calm middle
          of the page, where the product's promises are shown. */}
      <Section
        id="trust"
        labelledBy="trust-heading"
        className="trust-band relative overflow-clip"
        containerClassName="relative"
        backdrop={<SoftNotes preset="band" />}
      >
        <SectionHeader
          id="trust-heading"
          align="left"
          eyebrow={trust.eyebrow}
          heading={trust.heading}
          intro={trust.intro}
        />
        <div className="mt-12">
          <TrustShots shots={trust.shots} />
        </div>
        <div className="mt-16">
          <TrustGrid items={trust.items} />
        </div>
      </Section>

      {/* Roles ------------------------------------------------------------- */}
      <Section id="roles" labelledBy="roles-heading">
        <SectionHeader id="roles-heading" eyebrow={roles.eyebrow} heading={roles.heading} intro={roles.intro} />
        <div className="mt-12">
          <RoleGrid cta={roles.cta} groups={roles.groups} />
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

      {/* Pricing: off until there is something to buy (landing.json) ------ */}
      {pricing.enabled ? (
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
                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-display font-medium tracking-tight text-ink">
                      ${plan.priceUsd}
                    </span>
                    {plan.originalPriceUsd ? (
                      <span className="text-xl font-normal text-ink-muted line-through decoration-line-strong">
                        <span className="sr-only">Original price: </span>
                        ${plan.originalPriceUsd}
                      </span>
                    ) : null}
                    <span className="text-sm font-normal tracking-normal text-ink-muted"> / month</span>
                  </div>
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
        {pricing.proof ? (
          <figure className="mx-auto mt-12 max-w-4xl">
            <ProductShotImage image={pricing.proof.image} alt="The Roster's summary of the last seven days" sizes="(min-width: 896px) 896px, 100vw" />
            <figcaption className="mt-3 text-center text-sm text-ink-muted">{pricing.proof.caption}</figcaption>
          </figure>
        ) : null}
        <p className="mt-8 text-center text-sm text-ink-muted">{pricing.footnote}</p>
        <p className="mt-2 text-center text-sm text-ink-muted">{pricing.reassurance}</p>
      </Section>
      ) : null}

      {/* FAQ ---------------------------------------------------------------- */}
      <Section id="faq" labelledBy="faq-heading" className="border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <SectionHeader id="faq-heading" align="left" eyebrow={faq.eyebrow} heading={faq.heading} intro={faq.intro} />
          <Faq items={faq.items} />
        </div>
      </Section>

      {/* CTA ---------------------------------------------------------------- */}
      {/* The page's bookend: one big note on the dotted paper, with the one
          call the page makes on it. */}
      <section className="relative overflow-clip border-t border-line">
        <SoftNotes preset="cta" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <StickyNote tone="lemon" tilt={-1.5} className="relative mx-auto max-w-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
              <h2 className="mx-auto max-w-xl font-hand text-hand-title text-balance">{cta.heading}</h2>
              <p className="mt-4 text-lg">{cta.body}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href={cta.button.href} className={CTA_PRIMARY}>
                  {cta.button.label}
                  <ArrowRight aria-hidden />
                </Link>
                {cta.secondary ? (
                  <Link href={cta.secondary.href} className={CTA_SECONDARY}>
                    {cta.secondary.label}
                  </Link>
                ) : null}
              </div>
              <p className="mt-4 text-sm">{cta.microcopy}</p>
              <BrandMark className="absolute bottom-4 right-5 size-6 -rotate-12 opacity-40" />
            </StickyNote>
          </Reveal>
        </div>
      </section>
    </>
  );
}
