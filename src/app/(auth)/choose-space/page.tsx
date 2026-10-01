import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { spaceChoices, type SpaceChoice } from "@/lib/space-entry";
import { BrandLockup } from "@/components/brand-logo";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Where to?" };
export const dynamic = "force-dynamic";

/**
 * After signing in, someone with a business space and a personal space picks
 * which one to open. With only one kind there is nothing to ask: straight in.
 * Switching later is the space menu at the top of the sidebar.
 */
export default async function ChooseSpacePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const choices = await spaceChoices(user.id);
  if (choices.length === 0) redirect("/");
  if (new Set(choices.map((choice) => choice.kind)).size === 1) redirect(choices[0]!.href);

  const business = choices.filter((choice) => choice.kind === "business");
  const personal = choices.filter((choice) => choice.kind === "personal");
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="w-full max-w-lg space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
          Welcome back{firstName ? `, ${firstName}` : ""}. Where to?
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          You can switch any time from the space menu at the top of the sidebar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SpaceCard
          icon={<Building2 className="size-5" aria-hidden />}
          title="Business"
          blurb="Your AI staff, your team and your clients."
          choices={business}
        />
        <SpaceCard
          icon={<UserRound className="size-5" aria-hidden />}
          title="Personal"
          blurb="Your own assistants. Private to you."
          choices={personal}
        />
      </div>
    </div>
  );
}

function SpaceCard({ icon, title, blurb, choices }: { icon: React.ReactNode; title: string; blurb: string; choices: SpaceChoice[] }) {
  // One space of this kind: the whole card is the way in. Several: one row each.
  if (choices.length === 1) {
    const choice = choices[0]!;
    return (
      <Link href={choice.href} className="group block rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <Panel className="flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-accent-line">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
          <span>
            <span className="block text-base font-semibold text-ink">{title}</span>
            <span className="mt-0.5 block text-sm text-ink-muted">{choice.name}</span>
          </span>
          <span className="text-sm text-ink-muted">{blurb}</span>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent">
            Open
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Panel>
      </Link>
    );
  }
  return (
    <Panel className="flex h-full flex-col gap-3 p-5">
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
      <span>
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-muted">{blurb}</span>
      </span>
      <ul className="space-y-1">
        {choices.map((choice) => (
          <li key={choice.href}>
            <Link
              href={choice.href}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-2"
            >
              <span className="truncate">
                {choice.name}
                {choice.project ? <span className="text-ink-muted"> · {choice.project}</span> : null}
              </span>
              <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
