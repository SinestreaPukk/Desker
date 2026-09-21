"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, ChevronDown, ChevronRight } from "lucide-react";
import { ApprovalCard } from "@/components/work/approval-card";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
import { useActionItems } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { ACTION_STATUSES, STATUS_LABELS } from "@/lib/work/types";
import { formatRelativeTime, safeHttpUrl } from "@/lib/utils";

const TRIGGER_LABEL: Record<string, string> = {
  schedule: "Scheduled",
  webhook: "Webhook",
  manual: "Manual",
  followup: "Follow-up",
};

/**
 * The rough table. Every action item in the project, newest first, with the
 * one control that must exist now: approve or reject what is waiting. The
 * Inbox's Approvals tab replaces this surface; the routes stay.
 */
export function WorkView({
  project,
  initialAgentId,
  initialStatus,
  focusItemId,
}: {
  project: string;
  initialAgentId: string;
  initialStatus: string;
  /** From a link in the inbox: open this item on arrival. */
  focusItemId?: string;
}) {
  const [agentId, setAgentId] = React.useState(initialAgentId);
  const [status, setStatus] = React.useState(initialStatus);
  const agents = useAgents(project);
  const items = useActionItems(
    { project, agentId: agentId === "all" ? undefined : agentId, status: status === "all" ? undefined : status },
    { refetchInterval: 5_000 },
  );

  const waiting = items.data?.filter((item) => item.status === "needs_approval").length ?? 0;

  return (
    <Page>
      <PageHeader
        title="Work"
        description="Everything your agents have done on their own, and what is waiting on you."
      />

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="work-agent" className="sr-only">
            Agent
          </label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger id="work-agent" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agents.data ?? []).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label htmlFor="work-status" className="sr-only">
            Status
          </label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="work-status" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ACTION_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {waiting > 0 ? <Badge tone="warning">{waiting} waiting for approval</Badge> : null}
        </div>
      </PageToolbar>

      <PageBody>
        {items.isLoading ? (
          <LoadingRows count={4} />
        ) : items.error ? (
          <ErrorState message={errorMessage(items.error)} onRetry={() => void items.refetch()} />
        ) : items.data && items.data.length > 0 ? (
          <Panel className="divide-y divide-line">
            {items.data.map((item) => (
              <ActionItemRow key={item.id} item={item} project={project} initiallyOpen={item.id === focusItemId} />
            ))}
          </Panel>
        ) : (
          <EmptyState
            icon={Briefcase}
            title="Nothing has run yet"
            description="Give an agent a scope of work with a schedule or a webhook trigger, or press Run now in its editor. Runs and anything awaiting approval land here."
          />
        )}
      </PageBody>
    </Page>
  );
}

function ActionItemRow({
  item,
  project,
  initiallyOpen,
}: {
  item: ActionItemDto;
  project: string;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = React.useState(initiallyOpen || item.status === "needs_approval");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        )}
        <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-ink">{item.agent.name}</span>
            <span className="text-ink-muted">{TRIGGER_LABEL[item.trigger] ?? item.trigger}</span>
            <span className="text-xs text-ink-subtle">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <p className="truncate text-xs text-ink-muted">
            {item.summary ?? item.error ?? (item.status === "in_progress" ? "Working…" : "Not started")}
          </p>
        </div>
        {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : null}
        <StatusBadge status={item.status} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line bg-surface-2/40 px-4 py-4 text-sm">
          {item.status === "needs_approval" && item.pendingAction ? (
            <ApprovalCard item={item} project={project} />
          ) : null}

          {item.escalatedAt && item.status !== "needs_approval" ? (
            <p className="rounded-sm border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">
              Escalated by the agent: {item.escalationReason}
            </p>
          ) : null}

          {item.error ? <p className="text-danger">{item.error}</p> : null}

          {item.summary ? (
            <section>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">Report</h4>
              <pre className="whitespace-pre-wrap font-sans leading-relaxed text-ink">{item.summary}</pre>
            </section>
          ) : null}

          {item.findings.length > 0 ? (
            <section>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">Findings</h4>
              {item.findings.map((finding, index) => (
                <details key={index} className="mb-2 rounded-sm border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-ink">{finding.query}</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-ink-muted">
                    {finding.findings}
                  </pre>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {finding.sources.map((source, i) => {
                      const href = safeHttpUrl(source.url);
                      return (
                        <li key={i}>
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                              [{i + 1}] {source.title}
                            </a>
                          ) : (
                            <span className="text-ink-muted">
                              [{i + 1}] {source.title} <span className="text-ink-subtle">(unlinked: not an http URL)</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </section>
          ) : null}

          {item.drafts.length > 0 ? (
            <section>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">Drafts</h4>
              {item.drafts.map((draft) => (
                <details key={draft.id} className="mb-2 rounded-sm border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-ink">
                    <StatusBadge status={draft.status} className="mr-2" />
                    {draft.title}
                    <span className="ml-2 text-xs text-ink-subtle">{draft.kind.replace("_", " ")}</span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-ink">{draft.body}</pre>
                </details>
              ))}
            </section>
          ) : null}

          {item.external ? (
            <p className={item.external.ok ? "text-positive" : "text-danger"}>
              Delivery: {item.external.detail}
            </p>
          ) : null}

          {item.steps.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-ink-subtle">
                {item.steps.length} tool call{item.steps.length === 1 ? "" : "s"}
              </summary>
              <ol className="mt-2 space-y-1.5">
                {item.steps.map((step, index) => (
                  <li key={index} className="rounded-sm border border-line bg-surface p-2 text-xs">
                    <span className={step.ok ? "text-ink" : "text-danger"}>
                      <code className="font-mono">{step.tool}</code>
                    </span>
                    <span className="ml-2 text-ink-subtle">{formatRelativeTime(step.at)}</span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink-muted">
                      {JSON.stringify(step.input)}
                    </pre>
                    <p className="mt-1 whitespace-pre-wrap text-ink-muted">{step.output}</p>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          <p className="text-xs text-ink-subtle">
            {item.inputTokens + item.outputTokens > 0
              ? `${item.inputTokens.toLocaleString()} in / ${item.outputTokens.toLocaleString()} out tokens · `
              : ""}
            <Link href={`/p/${project}/agents/${item.agent.id}`} className="text-accent hover:underline">
              Open {item.agent.name}
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
