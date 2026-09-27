"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Play, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge, statusLabel } from "@/components/ui/badge";
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
import { CollabTag, RunDetail, runTitle } from "@/components/work/run-detail";
import { CancelRunButton, RemoveButton } from "@/components/work/row-actions";
import { useAgents } from "@/hooks/use-admin-data";
import { FINISHED, useActionItem, useActionItems, useRunScope, useScope, useSuggestions } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { ACTION_STATUSES, TRIGGER_LABELS } from "@/lib/work/types";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";

/** Wide enough for the list and the run beside it: the reading-pane layout. */
function useSplitView(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1280px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => false,
  );
}

/**
 * Every run in the project, as a native split view: what needs the owner
 * pinned first and set a size up, then what is running, queued and finished.
 * On a wide screen the open run reads beside the list, so the owner never
 * loses their place; on a narrow one it opens on its own page.
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
  const split = useSplitView();
  // The selection lives in the address (?run=), so a refresh or a shared link keeps it.
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("run"),
  );
  const agents = useAgents(project);
  // Poll briskly only while something is moving; a finished list barely changes.
  const items = useActionItems(
    { project, agentId: agentId === "all" ? undefined : agentId, view: "list" },
    { refetchInterval: (list) => (list?.some((item) => !FINISHED.has(item.status)) ? 5_000 : 30_000) },
  );

  // Filtered here rather than by the API: the counts and groups read off the same list.
  const all = (items.data ?? []).filter((item) => status === "all" || item.status === status);
  const active = all.filter((item) => !FINISHED.has(item.status));
  const finished = all.filter((item) => FINISHED.has(item.status));

  const select = React.useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("run", id);
    window.history.replaceState(null, "", url);
  }, []);
  // Nothing chosen yet: open what needs the owner, else the newest run that has something to read.
  const shown = selectedId ?? all.find((item) => item.status === "needs_approval")?.id ?? all.find((item) => item.status !== "queued")?.id ?? null;

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

  const row = (item: ActionItemDto, group?: string) => (
    <RunRow
      key={item.id}
      item={item}
      project={project}
      openSuggestions={openSuggestionsByRun.get(item.id) ?? 0}
      prominent={group === "Waiting on you"}
      // Active groups already say the state in their heading; only finished runs, which mix outcomes, show it.
      showStatus={!group}
      selected={split && item.id === shown}
      onSelect={split ? select : undefined}
    />
  );

  const list = (
    <div className="space-y-6">
      <TodayStrip items={items.data ?? []} />

      {groupActive(active).map((group) => (
        <RunGroup key={group.label} label={group.label} count={group.items.length}>
          {group.items.map((item) => row(item, group.label))}
        </RunGroup>
      ))}

      {finished.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Finished</h2>
            <RemoveButton
              targets={finished.map((item) => ({ kind: "run" as const, id: item.id }))}
              what={`all ${finished.length} finished run${finished.length === 1 ? "" : "s"}${agentId === "all" ? "" : " for this agent"}`}
              label="Clear finished"
            />
          </div>
          {groupByDay(finished).map((group) => (
            <RunGroup key={group.label} label={group.label} count={group.items.length} level={3} dense>
              {group.items.map((item) => row(item))}
            </RunGroup>
          ))}
        </div>
      ) : null}
    </div>
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
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
            <label htmlFor="work-status" className="sr-only">
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="work-status" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ACTION_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label htmlFor="work-agent" className="sr-only">
              Agent
            </label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="work-agent" className="sm:w-48">
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
        ) : all.length === 0 && status !== "all" ? (
          <EmptyState
            icon={Workflow}
            title={`No ${statusLabel(status).toLowerCase()} runs`}
            description="Nothing matches this status. Pick All statuses to see everything."
          />
        ) : all.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="Nothing has run yet"
            description="Give an agent a scope of work with a schedule or a webhook trigger, or press Run now in its editor. Runs and anything awaiting approval land here."
          />
        ) : split ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-6">
            {list}
            <RunPane id={shown} project={project} />
          </div>
        ) : (
          list
        )}
      </PageBody>
    </Page>
  );
}

/**
 * The reading pane: the open run beside the list. It keeps to the viewport
 * and scrolls on its own, and its content cross-fades when the selection
 * changes, so switching runs reads as one surface updating.
 */
function RunPane({ id, project }: { id: string | null; project: string }) {
  return (
    <aside
      aria-label="Selected run"
      className="sticky top-14 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-panel border border-line/50 bg-surface"
    >
      {id ? (
        <RunPaneContent key={id} id={id} project={project} />
      ) : (
        <p className="p-8 text-center text-sm text-ink-muted">Pick a run to read it here.</p>
      )}
    </aside>
  );
}

function RunPaneContent({ id, project }: { id: string; project: string }) {
  const run = useActionItem(id);
  const suggestions = useSuggestions({ project });
  const item = run.data;
  if (run.isPending) return <div className="p-6"><LoadingRows count={3} /></div>;
  if (run.error || !item) return <div className="p-6"><ErrorState message={errorMessage(run.error)} onRetry={() => void run.refetch()} /></div>;
  return (
    <div className="animate-in fade-in-0 duration-200 ease-out">
      <header className="flex items-start gap-3 border-b border-line/70 p-5">
        <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-ink">{runTitle(item)}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {item.agent.name}
            {item.agent.jobTitle ? `, ${item.agent.jobTitle}` : ""} · {TRIGGER_LABELS[item.trigger] ?? item.trigger} ·{" "}
            {formatRelativeTime(item.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CollabTag item={item} />
          {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : <StatusBadge status={item.status} />}
          {item.status === "in_progress" ? <CancelRunButton id={item.id} /> : null}
          {["in_progress", "approved", "executing_external"].includes(item.status) ? null : (
            <RemoveButton targets={[{ kind: "run", id: item.id }]} what="this run" />
          )}
          <Button asChild variant="ghost" size="icon-sm" aria-label="Open on its own page" title="Open on its own page">
            <Link href={`/p/${project}/work/${item.id}`}>
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </div>
      </header>
      <div className="p-5">
        <RunDetail
          item={item}
          project={project}
          suggestions={(suggestions.data ?? []).filter((suggestion) => suggestion.actionItemId === item.id)}
        />
      </div>
    </div>
  );
}

/** The current minute, ticking; null on the server so the strip renders after hydration. */
function useMinute(): number | null {
  return React.useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, 15_000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

/**
 * Today at a glance: each run's agent placed at its time, a thin indigo line
 * for now. Running agents pulse at the line; what is scheduled later waits,
 * faint, to its right. The one live marker on the page.
 */
function TodayStrip({ items }: { items: ActionItemDto[] }) {
  const now = useMinute();
  if (now === null) return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const position = (at: number) => `${((at - dayStart) / 86_400_000) * 100}%`;
  const today = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
  const marks = items
    .map((item) => {
      const at =
        item.status === "queued"
          ? today(item.scheduledFor)
          : item.status === "in_progress"
            ? now
            : today(item.completedAt ?? item.startedAt ?? item.createdAt);
      return { item, at };
    })
    .filter(({ at }) => at >= dayStart && at < dayStart + 86_400_000);

  if (marks.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-sm text-ink-muted">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        <span className="font-semibold text-ink">Today</span> Nothing has run or is scheduled yet.
      </p>
    );
  }

  return (
    <Panel className="px-5 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Today</h2>
        <p className="text-xs text-ink-muted">{`${marks.length} run${marks.length === 1 ? "" : "s"} today`}</p>
      </div>
      <div className="relative mt-3 h-9">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
        {marks.map(({ item, at }) => (
          <span
            key={item.id}
            title={`${item.agent.name}: ${runTitle(item)} (${statusLabel(item.status)}, ${formatTime(at)})`}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
              item.status === "queued" && "opacity-45",
              item.status === "in_progress" && "outline-2 outline-offset-1 outline-accent motion-safe:animate-pulse",
            )}
            style={{ left: position(at) }}
          >
            <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" className="size-6" />
          </span>
        ))}
        <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-accent" style={{ left: position(now) }} aria-hidden>
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent" />
        </span>
      </div>
      <div className="mt-1 flex justify-between text-meta text-ink-muted tabular-nums" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </Panel>
  );
}

function RunGroup({
  label,
  count,
  level = 2,
  dense = false,
  children,
}: {
  label: string;
  count: number;
  /** 2 for the active groups under the page title, 3 for the days under "Finished". */
  level?: 2 | 3;
  /** Finished history packs tighter: billed below what is still moving. */
  dense?: boolean;
  children: React.ReactNode;
}) {
  const id = `work-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className={dense ? "[--row-y:0.625rem]" : undefined}>
      <Heading id={id} className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-ink">
        {label}
        <span className="font-normal text-ink-muted">{count}</span>
      </Heading>
      <Panel className="overflow-hidden">{children}</Panel>
    </section>
  );
}

/**
 * One run, as a row in an inset group: the separator starts past the avatar,
 * as in a native list. Queued work has nothing to open yet, so it shows its
 * whole task in place. On a wide screen a click opens the run in the reading
 * pane; otherwise it opens on its own page. The row's link sits beside the
 * buttons rather than around them, so Remove, Cancel and their dialogs never
 * open the run.
 */
function RunRow({
  item,
  project,
  openSuggestions,
  prominent = false,
  showStatus = true,
  selected = false,
  onSelect,
}: {
  item: ActionItemDto;
  project: string;
  openSuggestions: number;
  /** Waiting on the owner: billed a size up, with the page's one solid action. */
  prominent?: boolean;
  showStatus?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const queued = item.status === "queued";
  const title = runTitle(item);
  const removable = !["in_progress", "approved", "executing_external"].includes(item.status);
  const open = (event: React.MouseEvent) => {
    if (!onSelect) return;
    event.preventDefault();
    onSelect(item.id);
  };

  return (
    <div
      className={cn(
        "group/row relative flex w-full items-center gap-3 pl-4 transition-colors duration-150",
        selected ? "bg-accent-soft" : "has-[a:hover]:bg-surface-2/70 has-[a:active]:bg-surface-2",
      )}
    >
      {queued ? null : (
        <Link
          href={`/p/${project}/work/${item.id}`}
          onClick={open}
          className="absolute inset-0"
          aria-label={`Open: ${title}`}
          aria-current={selected ? "true" : undefined}
        />
      )}
      <AgentAvatar
        name={item.agent.name}
        src={item.agent.avatarUrl}
        seed={item.agent.id}
        size={prominent ? "md" : "sm"}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-line/70 py-[var(--row-y,0.875rem)] pr-4 group-last/row:border-b-0">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-ink",
              prominent ? "text-base font-semibold" : "text-sm font-medium",
              queued ? "line-clamp-2" : "truncate",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {item.status === "in_progress" ? (
              <span className="mr-1.5 inline-flex items-center gap-1.5 font-medium text-accent">
                <span className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden />
                Working · {formatRelativeTime(item.startedAt ?? item.createdAt).replace(" ago", "")}
              </span>
            ) : null}
            {item.agent.name}
            {item.agent.jobTitle ? `, ${item.agent.jobTitle}` : ""} · {TRIGGER_LABELS[item.trigger] ?? item.trigger} ·{" "}
            {queued && item.scheduledFor
              ? `starts ${new Date(item.scheduledFor).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${formatTime(item.scheduledFor)}`
              : FINISHED.has(item.status)
                ? finishedAt(item.completedAt ?? item.createdAt)
                : formatRelativeTime(item.createdAt)}
            {openSuggestions > 0 ? ` · ${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : ""}
          </p>
        </div>
        {/* Beside the reading pane the row stays lean; the pane carries the rest. */}
        {onSelect ? null : <CollabTag item={item} />}
        {/* One state per row: an escalation outranks how the run ended. */}
        {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : showStatus ? <StatusBadge status={item.status} /> : null}
        <div className="relative z-10 flex items-center gap-1">
          {prominent ? (
            <Button size="sm" asChild>
              <Link href={`/p/${project}/work/${item.id}`} onClick={open}>
                Review
              </Link>
            </Button>
          ) : null}
          {item.status === "in_progress" && !onSelect ? <CancelRunButton id={item.id} /> : null}
          {removable && !prominent && (!onSelect || queued) ? (
            <RemoveButton targets={[{ kind: "run", id: item.id }]} what={queued ? "this queued run" : "this run"} />
          ) : null}
        </div>
        {queued || prominent ? null : <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />}
      </div>
    </div>
  );
}

/**
 * When a finished run ended, as read under its day heading: the 24hr time for today
 * and yesterday, the weekday too earlier in the week, the date before that.
 */
function finishedAt(iso: string): string {
  const at = new Date(iso);
  const time = formatTime(at);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysAgo = (startOfToday.getTime() - at.getTime()) / 86_400_000;
  if (daysAgo <= 1) return time;
  if (daysAgo <= 6) return `${at.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  return `${at.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
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
