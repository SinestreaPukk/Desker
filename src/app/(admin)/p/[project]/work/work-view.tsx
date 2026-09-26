"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Play, Workflow } from "lucide-react";
import { toast } from "sonner";
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
import { CollabTag, runTitle } from "@/components/work/run-detail";
import { CancelRunButton, RemoveButton } from "@/components/work/row-actions";
import { useAgents } from "@/hooks/use-admin-data";
import { FINISHED, useActionItems, useRunScope, useScope, useSuggestions } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { TRIGGER_LABELS } from "@/lib/work/types";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Every run in the project on one page: what is still active (waiting on
 * you, running, queued) at the top, finished work below it by day. A row
 * says what the work was; a run that has done something opens on its own
 * page, while queued work - which has nothing to show yet - stays in the list.
 */
export function WorkView({
  project,
  initialAgentId,
}: {
  project: string;
  initialAgentId: string;
}) {
  const [agentId, setAgentId] = React.useState(initialAgentId);
  const agents = useAgents(project);
  const items = useActionItems(
    { project, agentId: agentId === "all" ? undefined : agentId },
    { refetchInterval: 5_000 },
  );

  const all = items.data ?? [];
  const active = all.filter((item) => !FINISHED.has(item.status));
  const finished = all.filter((item) => FINISHED.has(item.status));

  // One fetch for the project; each row counts the suggestions its run raised.
  const suggestions = useSuggestions({ project });
  const openSuggestionsByRun = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const suggestion of suggestions.data ?? []) {
      if (suggestion.actionItemId && suggestion.pending) {
        map.set(suggestion.actionItemId, (map.get(suggestion.actionItemId) ?? 0) + 1);
      }
    }
    return map;
  }, [suggestions.data]);

  const row = (item: ActionItemDto) => (
    <RunRow key={item.id} item={item} project={project} openSuggestions={openSuggestionsByRun.get(item.id) ?? 0} />
  );

  return (
    <Page>
      <PageHeader
        title="Work"
        description="Everything your agents have done on their own, and what is waiting on you."
        actions={<RunAgentDialog agents={agents.data ?? []} defaultAgentId={agentId} />}
      />

      <PageToolbar>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{active.length}</span> active ·{" "}
            <span className="font-medium text-ink">{finished.length}</span> finished
          </p>
          <div>
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
          </div>
        </div>
      </PageToolbar>

      <PageBody>
        {items.isLoading ? (
          <LoadingRows count={4} />
        ) : items.error ? (
          <ErrorState message={errorMessage(items.error)} onRetry={() => void items.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="Nothing has run yet"
            description="Give an agent a scope of work with a schedule or a webhook trigger, or press Run now in its editor. Runs and anything awaiting approval land here."
          />
        ) : (
          <div className="space-y-6">
            {groupActive(active).map((group) => (
              <RunGroup key={group.label} label={group.label} count={group.items.length}>
                {group.items.map(row)}
              </RunGroup>
            ))}

            {finished.length > 0 ? (
              <div className={active.length > 0 ? "space-y-6 border-t border-line pt-6" : "space-y-6"}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">Finished</h2>
                  <RemoveButton
                    targets={finished.map((item) => ({ kind: "run" as const, id: item.id }))}
                    what={`all ${finished.length} finished run${finished.length === 1 ? "" : "s"}${agentId === "all" ? "" : " for this agent"}`}
                    label="Clear finished"
                  />
                </div>
                {groupByDay(finished).map((group) => (
                  <RunGroup key={group.label} label={group.label} count={group.items.length}>
                    {group.items.map(row)}
                  </RunGroup>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </PageBody>
    </Page>
  );
}

function RunGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const id = `work-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        {label}
        <span className="font-normal text-ink-subtle">{count}</span>
      </h3>
      <Panel className="divide-y divide-line">{children}</Panel>
    </section>
  );
}

/**
 * One run. Queued work has nothing to open yet, so it shows its whole task in
 * place; anything else opens on its own page. The row's link sits beside the
 * buttons rather than around them, so a click on Remove or Cancel (or in their
 * dialogs) never opens the run.
 */
function RunRow({ item, project, openSuggestions }: { item: ActionItemDto; project: string; openSuggestions: number }) {
  const queued = item.status === "queued";
  const title = runTitle(item);
  const removable = !["in_progress", "approved", "executing_external"].includes(item.status);

  return (
    <div className="relative flex w-full items-center gap-3 px-4 py-3.5 transition-colors duration-150 has-[a:hover]:bg-surface-2/60">
      {queued ? null : (
        <Link href={`/p/${project}/work/${item.id}`} className="absolute inset-0" aria-label={`Open: ${title}`} />
      )}
      <div className="shrink-0 rounded-full ring-1 ring-line/80">
        <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={queued ? "line-clamp-2 text-sm font-medium text-ink" : "truncate text-sm font-medium text-ink"}>
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {item.agent.name}
          {item.agent.jobTitle ? `, ${item.agent.jobTitle}` : ""} · {TRIGGER_LABELS[item.trigger] ?? item.trigger} ·{" "}
          {queued && item.scheduledFor
            ? `starts ${new Date(item.scheduledFor).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
            : formatRelativeTime(item.createdAt)}
          {openSuggestions > 0 ? ` · ${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : ""}
        </p>
      </div>
      <CollabTag item={item} />
      {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : null}
      <StatusBadge status={item.status} />
      <div className="relative z-10 flex items-center gap-1">
        {item.status === "in_progress" ? <CancelRunButton id={item.id} /> : null}
        {removable ? <RemoveButton targets={[{ kind: "run", id: item.id }]} what={queued ? "this queued run" : "this run"} /> : null}
      </div>
      {queued ? (
        <span className="size-4 shrink-0" aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      )}
    </div>
  );
}

type Group = { label: string; items: ActionItemDto[] };

function collect(items: ActionItemDto[], labelOf: (item: ActionItemDto) => string, order: string[]): Group[] {
  const groups = new Map<string, ActionItemDto[]>();
  for (const item of items) {
    const key = labelOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return order.filter((key) => groups.has(key)).map((key) => ({ label: key, items: groups.get(key)! }));
}

/** What needs you first, then what is moving, then what has not started. */
function groupActive(items: ActionItemDto[]): Group[] {
  return collect(
    items,
    (item) => (item.status === "needs_approval" ? "Waiting on you" : item.status === "queued" ? "Queued" : "Running"),
    ["Waiting on you", "Running", "Queued"],
  );
}

/** Newest first within each day (the API already sorts). */
function groupByDay(items: ActionItemDto[]): Group[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const day = 86_400_000;
  return collect(
    items,
    (item) => {
      const at = new Date(item.completedAt ?? item.createdAt).getTime();
      if (at >= today) return "Today";
      if (at >= today - day) return "Yesterday";
      if (at >= today - 6 * day) return "Earlier this week";
      return "Older";
    },
    ["Today", "Yesterday", "Earlier this week", "Older"],
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
