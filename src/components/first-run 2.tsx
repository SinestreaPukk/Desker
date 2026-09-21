"use client";

import Link from "next/link";
import { FileText, Plus, Rocket, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const STEPS = [
  {
    icon: UserRoundPlus,
    title: "Hire your first agent",
    body: "A name, a job title and a personality. Three short steps in the wizard.",
  },
  {
    icon: FileText,
    title: "Give it something to know",
    body: "Upload a policy, a price list or an FAQ. It answers from those, and cites them.",
  },
  {
    icon: Rocket,
    title: "Test it, then publish",
    body: "Talk to it in the live preview. Publish when it sounds right - you get a link and a widget.",
  },
] as const;

/**
 * The empty roster a brand-new organisation lands on. One clear next action
 * and the shape of the first ten minutes; no zeros, no chrome for things
 * that do not exist yet.
 */
export function FirstRun({ project }: { project: string }) {
  return (
    <Panel className="mx-auto max-w-2xl p-6 sm:p-8">
      <p className="meta">Welcome</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Nobody on the roster yet</h2>
      <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
        An AI employee answers your clients and, once you trust it, does work on its own. Here is
        how the first one comes to life - about five minutes end to end.
      </p>
      <ol className="mt-6 space-y-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent"
              >
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-[0.9375rem] font-medium text-ink">
                  <span className="mr-1.5 text-ink-subtle">{index + 1}.</span>
                  {step.title}
                </p>
                <p className="text-[0.8125rem] text-ink-muted">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href={`/p/${project}/agents/new`}>
            <Plus aria-hidden />
            Hire your first agent
          </Link>
        </Button>
        <p className="text-xs text-ink-subtle">Nothing is visible to clients until you publish.</p>
      </div>
    </Panel>
  );
}
