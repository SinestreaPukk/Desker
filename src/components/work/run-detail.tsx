"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Note } from "@/components/ui/note";
import { DecisionStamp } from "@/components/ui/decision-stamp";
import { Markdown } from "@/components/markdown";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalCard } from "@/components/work/approval-card";
import { RunFindings } from "@/components/work/run-findings";
import { SuggestionRow } from "@/components/work/suggestion-row";
import { TeamChat } from "@/components/work/team-chat";
import { useSetIssueStatus } from "@/hooks/use-admin-data";
import { useScope } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import { humanDuration } from "@/lib/insight-copy";
import type { ActionItemDto, SuggestionDto } from "@/lib/work/serialize";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";

/** The line a run is known by, in a list and as its page title. */
export function runTitle(item: ActionItemDto): string {
  // A scheduled or event run has no task of its own: it works through the agent's goals.
  return (
    item.headline ??
    item.error ??
    (item.task ? shortTask(item.task) : item.trigger === "webhook" ? "Respond to a new event" : "Work on its regular goals")
  );
}

/** A task's first sentence, cut at a word to fit a title; the run shows the task in full. */
function shortTask(task: string): string {
  const first = task.trim().split(/(?<=[.!?])\s/)[0]!.replace(/\.$/, "");
  if (first.length <= 90) return first;
  return `${first.slice(0, 90).replace(/\s+\S*$/, "").replace(/[,;:]$/, "")}…`;
}

/** The agent asked for a person on this run, and nobody has marked it handled yet. */
export function isFlagged(item: ActionItemDto): boolean {
  return Boolean(item.escalatedAt) && item.openIssueIds.length > 0;
}

/** One state per run: an open flag outranks how the run ended. */
export function RunBadge({ item }: { item: ActionItemDto }) {
  return isFlagged(item) ? <Badge tone="danger">Flagged</Badge> : <StatusBadge status={item.status} />;
}

/**
 * Takes a flagged or failed run off Needs you. It resolves the run's issues,
 * so the Inbox's Issues tab agrees; the flag itself stays on the record.
 */
function MarkHandled({ item }: { item: ActionItemDto }) {
  const setStatus = useSetIssueStatus();
  const [pending, setPending] = React.useState(false);
  async function handle() {
    setPending(true);
    try {
      await Promise.all(item.openIssueIds.map((issueId) => setStatus.mutateAsync({ issueId, status: "resolved" })));
      toast.success("Marked handled", { description: "It has left Needs you." });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2/60 px-3 py-2">
      <p className="text-ink-muted">Dealt with it? Mark it handled to take it off Needs you.</p>
      <Button size="sm" variant="secondary" onClick={() => void handle()} loading={pending}>
        <Check aria-hidden />
        Mark handled
      </Button>
    </div>
  );
}

/** Why a run started, as a sentence. */
const WHY: Record<string, string> = {
  schedule: "It runs on the schedule you set.",
  webhook: "Something outside Desker started it.",
  manual: "Someone started it by hand.",
  followup: "It planned this during an earlier run.",
  delegation: "A teammate asked for it.",
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What a finished run produced, in one line: "Took about 3 minutes · wrote 2 drafts · looked up 4 things". */
function outcomeLine(item: ActionItemDto): string {
  const parts: string[] = [];
  if (item.startedAt && item.completedAt) {
    parts.push(`took ${humanDuration(Date.parse(item.completedAt) - Date.parse(item.startedAt))}`);
  }
  if (item.drafts.length > 0) parts.push(`wrote ${plural(item.drafts.length, "draft")}`);
  const searches = new Set(item.findings.map((finding) => finding.query.trim().toLowerCase())).size;
  if (searches > 0) parts.push(`looked up ${plural(searches, "thing")}`);
  if (item.collab.handoffs.length > 0) parts.push(`asked ${plural(item.collab.handoffs.length, "teammate")} for help`);
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
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
  const name = item.agent.name;

  return (
    <div className="space-y-8 text-sm">
      {item.status === "needs_approval" && item.pendingAction ? <ApprovalCard item={item} project={project} /> : null}

      {/* A decided run carries its decision as a stamp: what the owner said
          about the thing that would have left the building. */}
      {item.approvedAt || item.status === "rejected" ? (
        <Note tone={item.status === "rejected" ? "lilac" : "mint"} className="overflow-hidden px-4 py-3.5 pr-28 text-note-ink">
          <DecisionStamp
            kind={item.status === "rejected" ? "rejected" : "approved"}
            className="right-4 top-1/2 size-16 -translate-y-1/2 text-xl"
          />
          <p className="text-sm font-semibold">
            {item.status === "rejected" ? "You rejected this. Nothing was sent." : "You approved this."}
          </p>
          {item.approvedAt ? (
            <p className="mt-0.5 text-xs">Approved {formatDateTime(item.approvedAt)}. The Audit log has the full record.</p>
          ) : null}
        </Note>
      ) : null}

      {item.escalatedAt && item.status !== "needs_approval" ? (
        isFlagged(item) ? (
          <p className="rounded-md border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">
            <span className="font-medium">{name} needs you:</span> {item.escalationReason}
          </p>
        ) : (
          <p className="rounded-md border border-line px-3 py-2 text-ink-muted">
            <span className="font-medium text-ink">{name} flagged this (handled):</span> {item.escalationReason}
          </p>
        )
      ) : null}

      {item.error ? (
        <p className="rounded-md border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">
          <span className="font-medium">Why it stopped:</span> {item.error}
        </p>
      ) : null}

      {item.openIssueIds.length > 0 && item.status !== "needs_approval" ? <MarkHandled item={item} /> : null}

      {item.status === "queued" || item.status === "in_progress" ? <RunPlan item={item} /> : null}

      {account ? (
        <RunSection title="What happened" hint={outcomeLine(item) || undefined}>
          <Markdown text={account} className="text-base text-ink" />
        </RunSection>
      ) : null}

      {suggestions.length > 0 ? (
        <RunSection
          title={`What ${name} suggests next`}
          hint={`Say yes and ${name} adds it to its regular work.`}
        >
          <ul className="divide-y divide-line/70 rounded-lg border border-line/70 px-4">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionRow suggestion={suggestion} project={project} inRun />
              </li>
            ))}
          </ul>
        </RunSection>
      ) : null}

      {item.findings.length > 0 ? (
        <RunSection title="What it looked up" hint="One card per question. Open one to read the answer and where it came from.">
          <RunFindings findings={item.findings} />
        </RunSection>
      ) : null}

      {item.drafts.length > 0 ? (
        <RunSection
          title="What it wrote"
          hint={item.drafts.every((draft) => draft.status === "draft") ? "Nothing has been sent." : undefined}
        >
          <div className="space-y-2">
            {item.drafts.map((draft) => (
              <details key={draft.id} className="group rounded-lg border border-line bg-surface">
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

      <TeamChat item={item} project={project} />

      {item.external ? (
        <p className={item.external.ok ? "text-positive" : "text-danger"}>
          {item.external.ok ? "Sent: " : "Could not send: "}
          {item.external.detail}
        </p>
      ) : null}

      {(item.report && item.report !== account) || item.steps.length > 0 || item.inputTokens + item.outputTokens > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
            Behind the scenes
            {item.steps.length > 0 ? ` · ${plural(item.steps.length, "step")}` : ""}
          </summary>
          <div className="mt-3 space-y-4">
            {item.report && item.report !== account ? (
              <section>
                <h4 className="eyebrow mb-1">{name}&apos;s full report</h4>
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
                    <span className="ml-2 text-ink-muted" title={formatDateTime(step.at, { withSeconds: true })}>
                      {formatTime(step.at, { withSeconds: true })} ({formatRelativeTime(step.at)})
                    </span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink-muted">
                      {JSON.stringify(step.input)}
                    </pre>
                    <p className="mt-1 whitespace-pre-wrap text-ink-muted">{step.output}</p>
                  </li>
                ))}
              </ol>
            ) : null}
            {item.inputTokens + item.outputTokens > 0 ? (
              <p className="text-xs text-ink-muted">
                AI usage: {item.inputTokens.toLocaleString()} tokens read, {item.outputTokens.toLocaleString()} written.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <p className="border-t border-line pt-3 text-xs text-ink-muted">
        <Link href={`/p/${project}/agents/${item.agent.id}`} className="text-accent hover:underline">
          Open {item.agent.name}
        </Link>
      </p>
    </div>
  );
}

/** Work not finished yet: what the agent is set to do, and when. */
function RunPlan({ item }: { item: ActionItemDto }) {
  // Only a run without a task of its own needs the agent's goals.
  const scope = useScope(item.task ? null : item.agent.id);
  const goals = scope.data?.objectives ?? [];
  const queued = item.status === "queued";
  const when = queued
    ? item.scheduledFor
      ? `Starts ${formatDateTime(item.scheduledFor)}.`
      : "Starts as soon as it can."
    : `Started ${formatRelativeTime(item.startedAt ?? item.createdAt)}. This updates by itself.`;

  return (
    <RunSection
      title={queued ? `What ${item.agent.name} will do` : `What ${item.agent.name} is doing`}
      hint={`${when} ${WHY[item.trigger] ?? ""}`.trim()}
    >
      {item.task ? (
        <Markdown text={item.task} className="text-base text-ink" />
      ) : goals.length > 0 ? (
        <>
          <p className="text-base text-ink">Work through its regular goals:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-ink">
            {goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
        </>
      ) : scope.isPending ? null : (
        <p className="text-base text-ink">Its regular work, following its job description.</p>
      )}
    </RunSection>
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
