"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { ActionStatusBadge } from "@/components/builder/scope-of-work-panel";
import { useAgents } from "@/hooks/use-admin-data";
import {
  useActionItems,
  useApproveActionItem,
  useRejectActionItem,
} from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { ACTION_STATUSES, STATUS_LABELS } from "@/lib/work/types";
import { formatRelativeTime } from "@/lib/utils";

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
}: {
  project: string;
  initialAgentId: string;
  initialStatus: string;
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
              <ActionItemRow key={item.id} item={item} project={project} />
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

function ActionItemRow({ item, project }: { item: ActionItemDto; project: string }) {
  const [open, setOpen] = React.useState(item.status === "needs_approval");
  const approve = useApproveActionItem();
  const reject = useRejectActionItem();
  const [note, setNote] = React.useState<string | null>(null);

  async function decide(verb: "approve" | "reject") {
    setNote(null);
    try {
      if (verb === "approve") await approve.mutateAsync({ id: item.id });
      else await reject.mutateAsync({ id: item.id });
    } catch (caught) {
      setNote(errorMessage(caught));
    }
  }

  const pendingDraft = item.pendingAction?.draftId
    ? item.drafts.find((draft) => draft.id === item.pendingAction!.draftId)
    : null;

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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
            <span className="font-medium text-ink">{item.agent.name}</span>
            <span className="text-ink-muted">{TRIGGER_LABEL[item.trigger] ?? item.trigger}</span>
            <span className="text-xs text-ink-subtle">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <p className="truncate text-xs text-ink-muted">
            {item.summary ?? item.error ?? (item.status === "in_progress" ? "Working…" : "Not started")}
          </p>
        </div>
        <ActionStatusBadge status={item.status} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line bg-surface-2/40 px-4 py-4 text-[0.8125rem]">
          {item.status === "needs_approval" && item.pendingAction ? (
            <div className="rounded-xl border border-warning-line bg-warning-soft/40 p-4">
              <p className="font-medium text-ink">
                Waiting for approval:{" "}
                {item.pendingAction.tool === "publish_post" ? "publish a post" : "send an email"}
              </p>
              {item.pendingAction.note ? (
                <p className="mt-1 text-ink-muted">{item.pendingAction.note}</p>
              ) : null}
              {item.pendingAction.tool === "send_email" ? (
                <p className="mt-1 text-xs text-ink-muted">
                  To: {(item.pendingAction.input.to as string[] | undefined)?.join(", ")} · Subject:{" "}
                  {String(item.pendingAction.input.subject ?? "")}
                </p>
              ) : null}
              {pendingDraft ? (
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 font-sans text-[0.8125rem] leading-relaxed text-ink">
                  {pendingDraft.body}
                </pre>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => void decide("approve")} disabled={approve.isPending || reject.isPending}>
                  <Check aria-hidden />
                  Approve and send
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void decide("reject")}
                  disabled={approve.isPending || reject.isPending}
                >
                  <X aria-hidden />
                  Reject
                </Button>
                {note ? <span className="text-xs text-danger">{note}</span> : null}
              </div>
            </div>
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
                <details key={index} className="mb-2 rounded-md border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-ink">{finding.query}</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-ink-muted">
                    {finding.findings}
                  </pre>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {finding.sources.map((source, i) => (
                      <li key={i}>
                        <a href={source.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          [{i + 1}] {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          ) : null}

          {item.drafts.length > 0 ? (
            <section>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">Drafts</h4>
              {item.drafts.map((draft) => (
                <details key={draft.id} className="mb-2 rounded-md border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-ink">
                    <Badge tone={draft.status === "draft" ? "neutral" : "positive"} className="mr-2">
                      {draft.status}
                    </Badge>
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
                  <li key={index} className="rounded-md border border-line bg-surface p-2 text-xs">
                    <span className={step.ok ? "text-ink" : "text-danger"}>
                      <code className="font-mono">{step.tool}</code>
                    </span>
                    <span className="ml-2 text-ink-subtle">{formatRelativeTime(step.at)}</span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-[0.6875rem] text-ink-muted">
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
