"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ApprovalCard } from "@/components/work/approval-card";
import { RunFindings } from "@/components/work/run-findings";
import { SuggestionRow } from "@/components/work/suggestion-row";
import { TeamChat } from "@/components/work/team-chat";
import type { ActionItemDto, SuggestionDto } from "@/lib/work/serialize";
import { formatRelativeTime } from "@/lib/utils";

/** The line a run is known by, in a list and as its page title. */
export function runTitle(item: ActionItemDto): string {
  return item.headline ?? item.error ?? item.task ?? (item.status === "in_progress" ? "Working…" : "Run");
}

/**
 * One run, read like a short report: the account, anything the agent
 * suggests, its research, its drafts - with the technical trail folded away
 * at the bottom.
 */
export function RunDetail({
  item,
  project,
  suggestions,
}: {
  item: ActionItemDto;
  project: string;
  suggestions: SuggestionDto[];
}) {
  // Older runs have no owner-facing summary; their report stands in for it.
  const account = item.summary ?? item.report;

  return (
    <div className="space-y-8 text-sm">
      {item.status === "needs_approval" && item.pendingAction ? <ApprovalCard item={item} project={project} /> : null}

      {item.escalatedAt && item.status !== "needs_approval" ? (
        <p className="rounded-md border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">
          <span className="font-medium">Escalated to you:</span> {item.escalationReason}
        </p>
      ) : null}

      {item.error ? (
        <p className="rounded-md border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">{item.error}</p>
      ) : null}

      {account ? (
        <RunSection title="What happened">
          <Markdown text={account} className="text-ink" />
        </RunSection>
      ) : null}

      {suggestions.length > 0 ? (
        <RunSection
          title="Suggestions"
          hint="What the agent thinks should happen next. Accepting one adds it to the agent's objectives."
        >
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionRow suggestion={suggestion} project={project} inRun />
              </li>
            ))}
          </ul>
        </RunSection>
      ) : null}

      {item.findings.length > 0 ? (
        <RunSection title="Research" hint="What each search turned up. Open one to read it in full, with its sources.">
          <RunFindings findings={item.findings} />
        </RunSection>
      ) : null}

      {item.drafts.length > 0 ? (
        <RunSection title="Drafts" hint="Written by the agent, nothing sent.">
          <div className="space-y-2">
            {item.drafts.map((draft) => (
              <details key={draft.id} className="group rounded-xl border border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{draft.title}</span>
                  <span className="hidden text-xs capitalize text-ink-muted sm:inline">{draft.kind.replace("_", " ")}</span>
                  <StatusBadge status={draft.status} />
                </summary>
                <div className="border-t border-line px-4 py-3">
                  <Markdown text={draft.body} className="text-ink" />
                </div>
              </details>
            ))}
          </div>
        </RunSection>
      ) : null}

      <TeamChat item={item} />

      {item.external ? (
        <p className={item.external.ok ? "text-positive" : "text-danger"}>Delivery: {item.external.detail}</p>
      ) : null}

      {(item.report && item.report !== account) || item.steps.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
            Technical details
            {item.steps.length > 0 ? ` · ${item.steps.length} tool call${item.steps.length === 1 ? "" : "s"}` : ""}
          </summary>
          <div className="mt-3 space-y-4">
            {item.report && item.report !== account ? (
              <section>
                <h4 className="eyebrow mb-1">The agent&apos;s own report</h4>
                <Markdown text={item.report} />
              </section>
            ) : null}
            {item.steps.length > 0 ? (
              <ol className="space-y-1.5">
                {item.steps.map((step, index) => (
                  <li key={index} className="rounded-sm border border-line bg-surface p-2 text-xs">
                    <span className={step.ok ? "text-ink" : "text-danger"}>
                      <code className="font-mono">{step.tool}</code>
                    </span>
                    <span className="ml-2 text-ink-muted">{formatRelativeTime(step.at)}</span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink-muted">
                      {JSON.stringify(step.input)}
                    </pre>
                    <p className="mt-1 whitespace-pre-wrap text-ink-muted">{step.output}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </details>
      ) : null}

      <p className="border-t border-line pt-3 text-xs text-ink-muted">
        {item.inputTokens + item.outputTokens > 0
          ? `${item.inputTokens.toLocaleString()} in / ${item.outputTokens.toLocaleString()} out tokens · `
          : ""}
        <Link href={`/p/${project}/agents/${item.agent.id}`} className="text-accent hover:underline">
          Open {item.agent.name}
        </Link>
      </p>
    </div>
  );
}

function RunSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** "from Bright" / "with Tim": that this run involved a colleague, before it is opened. */
export function CollabTag({ item }: { item: ActionItemDto }) {
  const { askedBy, handoffs } = item.collab;
  const label = askedBy
    ? `from ${askedBy.agent.name}`
    : handoffs.length > 0
      ? `with ${[...new Set(handoffs.map((h) => h.agent.name))].join(", ")}`
      : null;
  if (!label) return null;
  return (
    <Badge tone="accent" className="hidden sm:inline-flex">
      <UsersRound aria-hidden />
      {label}
    </Badge>
  );
}
