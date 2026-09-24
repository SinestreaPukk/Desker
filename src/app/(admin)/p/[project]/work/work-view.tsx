"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";
import { ApprovalCard } from "@/components/work/approval-card";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useActionItems, useRunScope, useScope } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { ACTION_STATUSES, STATUS_LABELS, TRIGGER_LABELS } from "@/lib/work/types";
import { cn, formatRelativeTime, safeHttpUrl } from "@/lib/utils";

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
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
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

          <RunAgentDialog agents={agents.data ?? []} defaultAgentId={agentId} />
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
    <div className="transition-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2/60"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-ink-subtle transition-transform duration-200",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <div className="shrink-0 rounded-full ring-1 ring-line/80">
          <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
            <span className="font-semibold text-ink">{item.agent.name}</span>
            <Badge tone="neutral" className="text-[10px] py-0 px-2 font-normal">
              {TRIGGER_LABELS[item.trigger] ?? item.trigger}
            </Badge>
            <span className="text-xs text-ink-muted">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {item.headline ??
              item.summary ??
              item.error ??
              (item.status === "in_progress" ? "Working…" : "Not started")}
          </p>
        </div>
        {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : null}
        <StatusBadge status={item.status} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line bg-surface-2/30 px-5 py-4 text-sm">
          {item.status === "needs_approval" && item.pendingAction ? (
            <ApprovalCard item={item} project={project} />
          ) : null}

          {item.escalatedAt && item.status !== "needs_approval" ? (
            <p className="rounded-sm border border-danger-line bg-danger-soft/40 px-3 py-2 text-danger">
              Escalated by the agent: {item.escalationReason}
            </p>
          ) : null}

          {item.error ? <p className="text-danger">{item.error}</p> : null}

          {/* The owner's account first; the agent's own report is underneath it
              for anyone who wants the detail. */}
          {item.summary ? (
            <section>
              <h4 className="eyebrow mb-1">What happened</h4>
              <p className="whitespace-pre-wrap leading-relaxed text-ink">{item.summary}</p>
            </section>
          ) : null}

          {item.report && item.report !== item.summary ? (
            <details>
              <summary className="eyebrow cursor-pointer">The agent&apos;s full report</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-ink-muted">
                {item.report}
              </pre>
            </details>
          ) : null}

          {item.findings.length > 0 ? (
            <section>
              <h4 className="eyebrow mb-1">Findings</h4>
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
                              [{i + 1}] {source.title} <span className="text-ink-muted">(unlinked: not an http URL)</span>
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
              <h4 className="eyebrow mb-1">Drafts</h4>
              {item.drafts.map((draft) => (
                <details key={draft.id} className="mb-2 rounded-sm border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-ink">
                    <StatusBadge status={draft.status} className="mr-2" />
                    {draft.title}
                    <span className="ml-2 text-xs text-ink-muted">{draft.kind.replace("_", " ")}</span>
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
              <summary className="eyebrow cursor-pointer">
                {item.steps.length} tool call{item.steps.length === 1 ? "" : "s"}
              </summary>
              <ol className="mt-2 space-y-1.5">
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
            </details>
          ) : null}

          <p className="text-xs text-ink-muted">
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

function RunAgentDialog({
  agents,
  defaultAgentId,
}: {
  agents: Array<{ id: string; name: string; avatarUrl?: string | null; jobTitle?: string }>;
  defaultAgentId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [chosenId, setChosenId] = React.useState<string | null>(null);

  const fallbackId = defaultAgentId && defaultAgentId !== "all" ? defaultAgentId : (agents[0]?.id ?? "");
  const selectedId = chosenId ?? fallbackId;

  const scope = useScope(selectedId);
  const run = useRunScope(selectedId);
  const selectedAgent = agents.find((a) => a.id === selectedId);

  async function handleStart() {
    if (!selectedId) return;
    try {
      await run.mutateAsync();
      toast.success(`Run started for ${selectedAgent?.name ?? "agent"}`, {
        description: "The agent is executing its scope of work. Results will update here.",
      });
      setOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  if (agents.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Play className="size-3.5 fill-current text-ink-muted" aria-hidden />
          <span>Run agent</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Run an agent now</DialogTitle>
        <DialogDescription>
          Trigger this agent&apos;s autonomous scope of work immediately. Research, drafts, and follow-ups will run according to its instructions.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="select-run-agent" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Select agent
            </label>
            <Select value={selectedId} onValueChange={setChosenId}>
              <SelectTrigger id="select-run-agent" className="w-full">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.jobTitle ? `(${a.jobTitle})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAgent ? (
            <div className="space-y-2 rounded-lg border border-line bg-surface-2/50 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-ink">
                <AgentAvatar name={selectedAgent.name} src={selectedAgent.avatarUrl} seed={selectedAgent.id} size="sm" />
                <span>{selectedAgent.name}</span>
                <span className="text-ink-muted">· {scope.data?.autonomy === "auto" ? "Autonomous" : "Draft-only mode"}</span>
              </div>
              {scope.data?.objectives && scope.data.objectives.length > 0 ? (
                <div>
                  <span className="mb-1 block text-ink-muted">Standing objectives:</span>
                  <ul className="list-inside list-disc space-y-0.5 text-ink">
                    {scope.data.objectives.slice(0, 3).map((obj, i) => (
                      <li key={i} className="truncate">{obj}</li>
                    ))}
                    {scope.data.objectives.length > 3 ? (
                      <li className="text-ink-muted">+{scope.data.objectives.length - 3} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : (
                <p className="text-ink-muted">
                  No custom objectives set yet. The agent will run based on its core responsibilities.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={() => void handleStart()} loading={run.isPending} disabled={!selectedId}>
            <Play className="size-3.5 fill-current" aria-hidden />
            Start run
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
