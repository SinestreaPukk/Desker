import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Clouds, Faq, RoleGrid, TrustLine } from "@/components/marketing/landing-blocks";
import { GLASS_BUTTON, SKY_LINK } from "@/components/marketing/glass-button";
import {
  ApprovalScene,
  AssistantScene,
  DevScene,
  Frame,
  HeroStage,
  MarketerScene,
  ResearcherScene,
  SupportScene,
} from "@/components/marketing/hero-stage";
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

/** Each feature's frame: the matching showreel scene, finished. */
const DEMOS = {
  support: { title: "Client chat · Mia", scene: <SupportScene beat={3} /> },
  marketer: { title: "Work · Nova · scheduled run", scene: <MarketerScene beat={3} /> },
  researcher: { title: "Work · Sol · weekly brief", scene: <ResearcherScene beat={3} /> },
  "dev-support": { title: "Client chat · Ada", scene: <DevScene beat={3} /> },
  assistant: { title: "Work · Kai · follow-ups", scene: <AssistantScene beat={3} /> },
  approval: { title: "Inbox · Approvals", scene: <ApprovalScene beat={3} /> },
} as const;

/**
 * The front door. A signed-in person has already been convinced; they go to
 * their workspace. Everyone else gets a clear morning: one serif headline in
 * the sky, one line, one button, and the product floating over the horizon.
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

  const { hero, features, roles, pricing, faq, cta } = LANDING;

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="sky relative -mt-14 pt-14">
        {/* The weather is clipped to the sky. The product window is not - it is
            meant to hang past the horizon, and the section used to cut it off. */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div className="sun right-[12%] top-[58%] hidden sm:block" />
          <Parallax className="absolute inset-0" distance={-40}>
            <Clouds />
          </Parallax>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-20 text-center sm:px-6 sm:pt-28">
          <h1 className="mx-auto max-w-4xl font-display text-hero text-balance text-[var(--sky-ink)]">
            {hero.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-[var(--sky-ink)] sm:text-xl sm:leading-snug">
            {hero.subhead}
          </p>
          {/* One button carries the page; the other is a link and looks like one. */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
            <Link href={hero.primaryCta.href} className={GLASS_BUTTON}>
              {hero.primaryCta.label}
              <ArrowRight aria-hidden />
            </Link>
            <Link href={hero.secondaryCta.href} className={SKY_LINK}>
              {hero.secondaryCta.label}
              <ArrowRight aria-hidden />
            </Link>
          </div>
          <p className="mt-6 text-sm text-[var(--sky-ink)]">{hero.note}</p>
          <TrustLine items={hero.trust} className="mt-4" />

          {/* The product, floating over the horizon and down into the page. */}
          <HeroStage className="relative z-10 mx-auto -mb-24 mt-14 max-w-4xl text-left sm:-mb-32 sm:mt-20" />
        </div>
      </section>

      {/* Features ------------------------------------------------------ */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-44 sm:px-6 sm:pb-28 sm:pt-56">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center text-title text-balance text-ink">{features.heading}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-muted">{features.intro}</p>
          </Reveal>
          <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
            {features.items.map((item) => {
              const demo = DEMOS[item.demo];
              return (
                <Reveal key={item.title}>
                  <div className="mx-auto max-w-2xl text-center">
                    <h3 className="text-xl font-medium tracking-tight text-balance text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-lg leading-relaxed text-ink-muted">{item.body}</p>
                  </div>
                  {/* inert, not aria-hidden: these are a picture of the product, and
                      aria-hidden left their Approve and Reject buttons in the tab
                      order for a keyboard user to land on. */}
                  <div className="mat mx-auto mt-10 max-w-4xl rounded-panel p-4 sm:p-6" inert>
                    <Frame title={demo.title}>{demo.scene}</Frame>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles --------------------------------------------------------- */}
      <section id="roles" className="sky-wash scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center text-title text-balance text-ink">{roles.heading}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-muted">{roles.intro}</p>
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <RoleGrid />
          </Reveal>
        </div>
      </section>

      {/* Pricing ------------------------------------------------------- */}
      <section id="pricing" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center text-title text-balance text-ink">{pricing.heading}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-muted">{pricing.intro}</p>
          </Reveal>
          {/* items-stretch keeps the three the same height; mt-auto on the
              button puts all three calls on one baseline whatever the blurb
              above them does. The popular one stands a row-height proud of
              its neighbours from md up, which is emphasis you can see from
              across the room - the ring alone was a detail nobody noticed. */}
          {/* Three columns only from lg. At 768 they were 230px wide and every
              feature line wrapped twice; below that it is one readable column. */}
          <div className="mx-auto mt-12 grid max-w-md items-stretch gap-4 lg:max-w-5xl lg:grid-cols-3">
            {Object.values(PLANS).map((plan, index) => {
              const popular = plan.id === pricing.popularPlan;
              return (
                <Reveal
                  key={plan.id}
                  delay={index * 0.08}
                  // Proud of its neighbours at the top only: pulled up a row
                  // of padding and given that height back, so it reads as the
                  // larger card while its foot - and so its call - still lands
                  // on the same line as the other two.
                  className={cn("h-full", popular && "lg:-mt-4 lg:h-[calc(100%+1rem)]")}
                >
                  <Panel
                    className={cn(
                      "lift relative flex h-full flex-col p-6 hover:shadow-md",
                      popular
                        ? "border-accent-line shadow-sm ring-2 ring-accent-line"
                        : "hover:border-accent-line",
                    )}
                  >
                    {popular ? (
                      <Badge tone="ember" className="absolute -top-2.5 left-6 shadow-xs">
                        {pricing.popularLabel}
                      </Badge>
                    ) : null}
                    <h3 className="text-lg font-semibold tracking-tight text-ink">{plan.name}</h3>
                    {/* Two lines' worth whether it needs them, so the three prices
                        sit on one line instead of stepping down the row. */}
                    <p className="mt-1 min-h-10 text-sm text-ink-muted">{plan.blurb}</p>
                    <p className="mt-5 text-display font-medium tracking-tight text-ink">
                      ${plan.priceUsd}
                      <span className="text-sm font-normal tracking-normal text-ink-muted"> / month</span>
                    </p>
                    <ul className="mt-6 space-y-2.5 text-sm text-ink-muted">
                      {[
                        `${plan.limits.publishedAgents} published agent${plan.limits.publishedAgents === 1 ? "" : "s"}`,
                        `${plan.limits.actionItemsPerMonth.toLocaleString()} autonomous runs a month`,
                        `${plan.limits.conversationsPerMonth.toLocaleString()} client conversations a month`,
                        `$${plan.limits.modelCostUsdPerMonth} model budget included`,
                      ].map((line) => (
                        <li key={line} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-auto w-full" variant={popular ? "cta" : "secondary"}>
                      <Link href="/signup">{plan.priceUsd === 0 ? "Start free" : `Start with ${plan.name}`}</Link>
                    </Button>
                  </Panel>
                </Reveal>
              );
            })}
          </div>
          {/* ink-subtle is the metadata tone and is only held to 3:1; what
              every plan includes is not metadata. */}
          <p className="mt-6 text-center text-sm text-ink-muted">{pricing.footnote}</p>
        </div>
      </section>

      {/* FAQ ----------------------------------------------------------- */}
      <section id="faq" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="text-center text-title text-balance text-ink">{faq.heading}</h2>
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <Faq items={faq.items} />
          </Reveal>
        </div>
      </section>

      {/* CTA ----------------------------------------------------------- */}
      <section className="sky relative overflow-hidden">
        <div className="sun left-[10%] top-[58%] hidden sm:block" aria-hidden />
        <Clouds />
        <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-24 text-center sm:px-6 sm:pb-56 sm:pt-32">
          <Reveal>
            {/* A bookend, not a second hero: the page has one headline at
                hero size and this is not it. Same serif, section scale. */}
            <h2 className="mx-auto max-w-3xl font-display text-title text-balance text-[var(--sky-ink)]">
              {cta.heading}
            </h2>
            <p className="mt-5 text-lg font-medium text-[var(--sky-ink)]">{cta.body}</p>
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
