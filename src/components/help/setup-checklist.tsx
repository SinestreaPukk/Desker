"use client";

import * as React from "react";
import Link from "next/link";
import { Check, FileUp, GitBranch, Plus, Rocket, UserRoundPlus, X, FileText } from "lucide-react";
import { useSpaceKind } from "@/components/space-kind";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useAgents } from "@/hooks/use-admin-data";
import { useProjectContext } from "@/hooks/use-work-data";
import { useHelp } from "@/components/help/help-panel";
import {
  dismissChecklist,
  hasSeenFlowView,
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
  const flowSeen = React.useSyncExternalStore(subscribeChecklist, hasSeenFlowView, () => false);

  const roster = agents.data ?? [];
  const firstAgent = roster[0];
  const editor = firstAgent ? `/p/${project}/agents/${firstAgent.id}` : `/p/${project}/roster`;
  const personal = useSpaceKind() === "personal";

  // Two different products, two different first days: a business hires staff
  // and switches them on; a person describes themselves, adds an assistant,
  // gives it something to read and switches it on.
  const steps: Step[] = personal
    ? [
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
          title: "Add your first assistant",
          body: "Pick what you want help with - money, your week, social media, your career, travel or learning - and give it a name.",
          done: roster.length > 0,
          href: `/p/${project}/agents/new`,
          cta: "Add an assistant",
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
      ]
    : [
        {
          id: "hire",
          icon: UserRoundPlus,
          title: "Hire your first agent",
          body: "Pick a role - research, marketing, sales, support, ops - then a name and a personality. Five short steps in the wizard.",
          done: roster.length > 0,
          href: `/p/${project}/agents/new`,
          cta: "Hire an agent",
        },
        {
          id: "context",
          icon: FileText,
          title: "Tell it about your business",
          body: "Four short answers, shared by every agent here. Or draft them from a document you already have.",
          done: (context.data?.answered ?? 0) > 0,
          href: `/p/${project}/roster`,
          cta: "Open Company context",
        },
        {
          id: "publish",
          icon: Rocket,
          title: "Publish it",
          body: "Try it in the chat beside the editor, then publish: it works on its schedule and answers in Team. Roles that talk to clients can also get a link and a website widget.",
          done: roster.some((agent) => agent.status === "published"),
          href: editor,
          cta: "Open the editor",
        },
        {
          id: "flow",
          icon: GitBranch,
          title: "See a run as a flow",
          body: "The scope of work drawn end to end: what starts it, which tools it may use, and where you get a say.",
          done: flowSeen,
          href: editor,
          cta: "Open the scope of work",
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
                {!step.done ? <p className="text-xs text-ink-muted">{step.body}</p> : null}
              </div>
              {!step.done ? (
                <Button asChild size="sm" variant={step.id === next.id ? "primary" : "ghost"}>
                  <Link href={step.href}>
                    {step.id === "hire" ? <Plus aria-hidden /> : null}
                    {step.cta}
                  </Link>
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
        <button
          type="button"
          onClick={() => help.open({ slug: personal ? "personal-space" : "hire-an-agent" })}
          className="-my-2 py-3 text-accent hover:underline"
        >
          Read the two-minute guide
        </button>
      </div>
    </Panel>
  );
}
