"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRetryRun } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { AgentStatus, AgentStatusAction } from "@/lib/work/agent-status";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";

const DOT: Record<AgentStatus["tone"], string> = {
  positive: "bg-positive",
  accent: "bg-accent motion-safe:animate-pulse",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-line-strong",
};

function Action({ action, project, primary }: { action: AgentStatusAction; project: string; primary: boolean }) {
  const retry = useRetryRun();
  const router = useRouter();
  if (action.kind === "link") {
    return (
      <Button asChild size="sm" variant={primary ? "primary" : "secondary"} className="relative z-10">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant={primary ? "primary" : "secondary"}
      className="relative z-10"
      loading={retry.isPending}
      onClick={async () => {
        try {
          const result = await retry.mutateAsync(action.runId);
          toast.success(result.resend ? "Back in Needs you" : "Running again", {
            description: result.resend
              ? "The same send waits for a fresh yes, now that the cause is fixed."
              : "A new run started with the same instruction.",
          });
          router.push(result.resend ? `/p/${project}/needs-you?item=${result.id}` : `/p/${project}/work/${result.id}`);
        } catch (caught) {
          toast.error(errorMessage(caught));
        }
      }}
    >
      <RotateCcw aria-hidden />
      {action.label}
    </Button>
  );
}

/**
 * Whether an agent is doing its job, in one place: a verdict, the last and
 * next run, and - whenever something is wrong - the thing to click.
 * `compact` is the roster card's one line; the full panel sits on the agent page.
 */
export function AgentHealth({ status, project, compact = false }: { status: AgentStatus; project: string; compact?: boolean }) {
  const { facts } = status;
  const headline = (
    <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
      <span className={cn("size-2 shrink-0 rounded-full", DOT[status.tone])} aria-hidden />
      <span className="truncate">{status.headline}</span>
    </p>
  );

  if (compact) {
    const action = status.actions[0];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {headline}
          {facts.nextRunAt ? (
            <span className="shrink-0 text-xs text-ink-muted" title={formatDateTime(facts.nextRunAt)}>
              Next {formatRelativeTime(facts.nextRunAt)}
            </span>
          ) : null}
        </div>
        {status.tone === "positive" || status.tone === "neutral" ? null : (
          <p className="line-clamp-2 text-xs text-ink-muted">{status.detail}</p>
        )}
        {action && status.tone !== "neutral" ? <Action action={action} project={project} primary={status.tone === "danger"} /> : null}
      </div>
    );
  }

  return (
    <section aria-label="How it's doing" className="rounded-panel border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {headline}
          <p className="mt-1 text-sm text-ink-muted">{status.detail}</p>
        </div>
        {status.actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {status.actions.map((action, index) => (
              <Action key={action.label} action={action} project={project} primary={index === 0} />
            ))}
          </div>
        ) : null}
      </div>
      <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-1.5 text-ink-muted">
          <History className="size-3.5 shrink-0" aria-hidden />
          <dt className="whitespace-nowrap">Last run:</dt>
          <dd className="min-w-0 truncate text-ink">
            {facts.lastRun ? (
              <Link href={`/p/${project}/work/${facts.lastRun.id}`} className="hover:underline" title={formatDateTime(facts.lastRun.at)}>
                {facts.lastRun.title} · {formatRelativeTime(facts.lastRun.at)}
              </Link>
            ) : (
              "not yet"
            )}
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-ink-muted">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <dt className="whitespace-nowrap">Next run:</dt>
          <dd className="min-w-0 truncate text-ink">
            {facts.nextRunAt ? (
              <span title={formatDateTime(facts.nextRunAt)}>
                {formatDateTime(facts.nextRunAt)} · {formatRelativeTime(facts.nextRunAt)}
              </span>
            ) : facts.runMode === "triggered" ? (
              "when an event arrives"
            ) : facts.runMode === "paused" ? (
              "paused"
            ) : (
              "when you give it a task"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
