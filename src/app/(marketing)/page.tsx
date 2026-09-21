import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Faq, Horizon, RoleGrid } from "@/components/marketing/landing-blocks";
import { GLASS_BUTTON } from "@/components/marketing/glass-button";
import {
  ApprovalScene,
  ChatScene,
  Frame,
  HeroStage,
  RosterScene,
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

const DEMOS = {
  chat: { title: "Inbox · Conversations", scene: <ChatScene beat={2} /> },
  roster: { title: "Roster", scene: <RosterScene beat={2} /> },
  approval: { title: "Inbox · Approvals", scene: <ApprovalScene beat={2} /> },
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
      <section className="sky relative -mt-14 overflow-hidden pt-14">
        <div className="sun right-[12%] top-[46%] hidden sm:block" aria-hidden />
        <Parallax className="absolute inset-x-0 bottom-0 h-[58%]" distance={-60}>
          <Horizon />
        </Parallax>
        {/* The foot of the mountains dissolves into the page. */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-paper" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 pt-20 text-center sm:px-6 sm:pt-28">
          <h1 className="mx-auto max-w-4xl font-display text-hero text-balance text-[var(--sky-ink)]">
            {hero.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-[var(--sky-ink)] sm:text-xl sm:leading-snug">
            {hero.subhead}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href={hero.primaryCta.href} className={GLASS_BUTTON}>
              {hero.primaryCta.label}
              <ArrowRight aria-hidden />
            </Link>
            <Link
              href={hero.secondaryCta.href}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-[var(--sky-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-ink)]"
            >
              {hero.secondaryCta.label}
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--sky-ink)]">{hero.note}</p>

          {/* The product, floating over the horizon and down into the page. */}
          <HeroStage className="relative z-10 mx-auto -mb-24 mt-16 max-w-4xl text-left sm:-mb-32 sm:mt-24" />
        </div>
      </section>

      {/* Features ------------------------------------------------------ */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-44 sm:px-6 sm:pb-28 sm:pt-56">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-center text-title text-balance text-ink">{features.heading}</h2>
          </Reveal>
          <div className="mt-16 space-y-24 sm:mt-24 sm:space-y-32">
            {features.items.map((item) => {
              const demo = DEMOS[item.demo];
              return (
                <Reveal key={item.title}>
                  <div className="mx-auto max-w-2xl text-center">
                    <h3 className="text-xl font-medium tracking-tight text-balance text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-lg leading-relaxed text-ink-muted">{item.body}</p>
                  </div>
                  <div className="mx-auto mt-10 max-w-4xl rounded-panel bg-sky-pale/60 p-3 dark:bg-surface-2 sm:p-6" aria-hidden>
                    <Frame title={demo.title}>{demo.scene}</Frame>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles --------------------------------------------------------- */}
      <section id="roles" className="scroll-mt-20 border-t border-line bg-surface-2/40">
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
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan, index) => (
              <Reveal key={plan.id} delay={index * 0.1} className="h-full">
                <Panel
                  className={cn(
                    "lift flex h-full flex-col p-6 hover:shadow-md",
                    plan.id === "starter" && "border-accent-line ring-1 ring-accent-line",
                  )}
                >
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{plan.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{plan.blurb}</p>
                  <p className="mt-5 text-display font-medium tracking-tight text-ink">
                    ${plan.priceUsd}
                    <span className="text-sm font-normal tracking-normal text-ink-muted"> / month</span>
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
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-ink-subtle">{pricing.footnote}</p>
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
        <div className="sun left-[10%] top-[30%] hidden sm:block" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-[55%]" aria-hidden>
          <Horizon />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-paper" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-24 text-center sm:px-6 sm:pb-56 sm:pt-32">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-display text-hero text-balance text-[var(--sky-ink)]">{cta.heading}</h2>
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
