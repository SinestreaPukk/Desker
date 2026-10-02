"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  FileUp,
  Rocket,
  UserRoundPlus,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useAgents } from "@/hooks/use-admin-data";
import { useProjectContext } from "@/hooks/use-work-data";
import { openTour } from "@/components/tour/tour";
import { useHelp } from "@/components/help/help-panel";
import {
  dismissChecklist,
  isChecklistDismissed,
  subscribeChecklist,
} from "@/components/help/checklist-state";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  icon: React.ComponentType;
  title: string;
  body: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * The four things that turn a new space into a working one - different for a
 * business and for a person.
 *
 * Useful once, not nagging forever: each step ticks itself off from what is
 * actually in the workspace, the whole thing can be dismissed, and it is
 * gone for good once every step is done. The help panel can bring it back.
 */
export function SetupChecklist({ project }: { project: string }) {
  const agents = useAgents(project);
  const context = useProjectContext(project);
  // Both live in this browser, and localStorage is not reactive: the store
  // hook subscribes to the events the writers fire. The server snapshot says
  // "dismissed", so the markup rendered there matches the first client paint
  // for everyone who has put it away.
  const dismissed = React.useSyncExternalStore(
    subscribeChecklist,
    isChecklistDismissed,
    () => true,
  );

  const roster = agents.data ?? [];
  const firstAgent = roster[0];
  const editor = firstAgent
    ? `/p/${project}/agents/${firstAgent.id}`
    : `/p/${project}/roster`;
  // A person describes themselves, adds an assistant, gives it something to
  // read and switches it on.
  const steps: Step[] = [
    {
      id: "context",
      icon: FileText,
      title: "Tell your assistants about you",
      body: "Four short answers every assistant reads: who you are, what you want help with, how to talk to you, and your limits.",
      done: (context.data?.answered ?? 0) > 0,
      href: `/p/${project}/organization`,
      cta: "Open About you",
    },
    {
      id: "hire",
      icon: UserRoundPlus,
      title: "Plan your week with your first assistant",
      body: "See it plan a week on example data, then connect your calendar and get your own plan - changes wait for you.",
      done: roster.length > 0,
      href: `/p/${project}/start`,
      cta: "Start here",
    },
    {
      id: "read",
      icon: FileUp,
      title: "Give it something to read",
      body: "A CSV statement for Money, your CV for Career, notes for Learning. Card and account numbers are masked.",
      done: roster.some((agent) => agent.documentCount > 0),
      href: editor,
      cta: "Open Knowledge",
    },
    {
      id: "publish",
      icon: Rocket,
      title: "Switch it on",
      body: "Try it in the chat beside the editor, then switch it on. It starts its routine and answers you in Chat - only you can reach it.",
      done: roster.some((agent) => agent.status === "published"),
      href: editor,
      cta: "Open the editor",
    },
  ];

  const done = steps.filter((step) => step.done).length;
  const help = useHelp();

  if (dismissed) return null;
  // Until the roster has loaded, every step would read as "not done" - which
  // tells somebody with five agents to hire their first one.
  if (agents.isPending || context.isPending) return null;
  // Finished is finished: it does not come back on its own.
  if (done === steps.length) return null;

  const next = steps.find((step) => !step.done)!;

  return (
    <Panel className="mb-4 overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Setting up</p>
          <p className="text-xs text-ink-muted">
            {done} of {steps.length} done · next: {next.title.toLowerCase()}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismissChecklist}>
          <X aria-hidden />
          Dismiss
        </Button>
      </div>

      <ol className="divide-y divide-line">
        {steps.map((step) => {
          const Icon = step.done ? Check : step.icon;
          return (
            <li key={step.id} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border [&_svg]:size-3.5",
                  step.done
                    ? "border-positive-line bg-positive-soft text-positive"
                    : "border-line bg-surface-2 text-ink-muted",
                )}
              >
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-ink-muted line-through" : "text-ink",
                  )}
                >
                  {step.title}
                </p>
                {!step.done ? (
                  <p className="text-xs text-ink-muted">{step.body}</p>
                ) : null}
              </div>
              {!step.done ? (
                <Button
                  asChild
                  size="sm"
                  variant={step.id === next.id ? "primary" : "ghost"}
                >
                  <Link href={step.href}>{step.cta}</Link>
                </Button>
              ) : (
                <span className="text-xs text-positive">Done</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span>Dismiss it any time; the help panel brings it back.</span>
        <span className="flex items-center gap-4">
          <button
            type="button"
            onClick={openTour}
            className="-my-2 py-3 font-medium text-accent hover:underline"
          >
            Take the tour
          </button>
          <button
            type="button"
            onClick={() => help.open({ slug: "personal-space" })}
            className="-my-2 py-3 text-accent hover:underline"
          >
            Read the two-minute guide
          </button>
        </span>
      </div>
    </Panel>
  );
}
