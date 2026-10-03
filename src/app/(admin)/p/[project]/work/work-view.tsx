"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Play, Search, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { statusLabel } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SectionTab } from "@/components/ui/section-tab";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { TabCount, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollabTag, isFlagged, RunBadge, RunDetail, runTitle } from "@/components/work/run-detail";
import { CancelRunButton, RemoveButton } from "@/components/work/row-actions";
import { CheckInList } from "@/components/work/check-in-card";
import { useAgents } from "@/hooks/use-admin-data";
import { FINISHED, useActionItem, useActionItems, useRunScope, useScope, useSuggestions } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { TRIGGER_LABELS } from "@/lib/work/types";
import { cn, formatRelativeTime, formatTime } from "@/lib/shared/utils";

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
 * What an owner brings to this page, as tabs: what is there, what is moving,
 * what got done, and the digests that sum it up. Decisions are not made here:
 * anything waiting on a person is in Needs you, the one action queue, and a
 * run here only points to it.
 */
const VIEWS = ["all", "active", "finished", "digests"] as const;
type View = (typeof VIEWS)[number];

function inView(view: View, item: ActionItemDto): boolean {
  if (view === "finished") return FINISHED.has(item.status);
  if (view === "active") return !FINISHED.has(item.status);
  return true;
}

/** What a search matches: the line a run is known by, its task and its agent. */
function matches(item: ActionItemDto, query: string): boolean {
  if (!query) return true;
  const haystack = `${runTitle(item)} ${item.task ?? ""} ${item.agent.name} ${item.agent.jobTitle}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

const EMPTY: Record<View, { title: string; description: string }> = {
  all: { title: "Nothing here yet", description: "" },
  active: {
    title: "Nothing running or queued",
    description: "Press New task to give an agent something to do now.",
  },
  finished: { title: "Nothing finished yet", description: "Work your agents complete lands here." },
  digests: { title: "", description: "" },
};

/**
 * Every run in the project, as a native split view: what needs the owner
 * pinned first and set a size up, then what is running, queued and finished.
 * On a wide screen the open run reads beside the list, so the owner never
 * loses their place; on a narrow one it opens on its own page.
 */
export function WorkView({
  project,
  initialAgentId,
  initialView,
}: {
  project: string;
  initialAgentId: string;
  initialView: string;
}) {
  const [agentId, setAgentId] = React.useState(initialAgentId);
  const [view, setViewState] = React.useState<View>(
    (VIEWS as readonly string[]).includes(initialView) ? (initialView as View) : "all",
  );
  const [search, setSearch] = React.useState("");
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

  // Filtered here rather than by the API: the tab counts and the groups read off the same list.
  const searched = (items.data ?? []).filter((item) => matches(item, search.trim()));
  const counts = {
    active: searched.filter((item) => inView("active", item)).length,
  };
  const all = searched.filter((item) => inView(view, item));
  const active = all.filter((item) => !FINISHED.has(item.status));
  const finished = all.filter((item) => FINISHED.has(item.status));

  // The tab and the open run live in the address, so a refresh or a shared link keeps them.
  const setParam = (key: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  const setView = (next: View) => {
    setViewState(next);
    setParam("view", next === "all" ? null : next);
  };
  const select = React.useCallback((id: string) => {
    setSelectedId(id);
    setParam("run", id);
  }, []);
  // Keep the reading pane tied to the current result set. A selected run that
  // leaves the list through search or filtering is cleared from the URL too.
  React.useEffect(() => {
    if (!selectedId || items.isLoading || all.some((item) => item.id === selectedId)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
  }, [all, items.isLoading, selectedId]);
  // Nothing chosen yet: open the newest visible run that has something to read.
  const stillListed = !!selectedId && (items.isLoading || all.some((item) => item.id === selectedId));
  const shown = (stillListed ? selectedId : null) ?? all.find((item) => item.status !== "queued")?.id ?? all[0]?.id ?? null;

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
      // Running and Queued say the state in their heading, except a run paused on a person.
      showStatus={!group || item.status === "needs_approval" || item.openIssueIds.length > 0}
      selected={split && item.id === shown}
      onSelect={split ? select : undefined}
    />
  );

  const list = (
    <div className="space-y-6">
      {view === "all" && !search ? (
        <TodayStrip items={items.data ?? []} project={project} onSelect={split ? select : undefined} />
      ) : null}

      {groupActive(active).map((group) => (
        <RunGroup key={group.label} label={group.label} count={group.items.length}>
          {group.items.map((item) => row(item, group.label))}
        </RunGroup>
      ))}

      {finished.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2>
              <SectionTab tone="mint">Finished</SectionTab>
            </h2>
            <RemoveButton
              targets={finished.map((item) => ({ kind: "run" as const, id: item.id }))}
              what={`all ${finished.length} finished run${finished.length === 1 ? "" : "s"}${agentId === "all" ? "" : " for this agent"}${search.trim() ? " matching your search" : ""}`}
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
        description="What your agents are doing and what they finished. Anything waiting on you is in Needs you."
        actions={<RunAgentDialog agents={agents.data ?? []} defaultAgentId={agentId} />}
      />

      <PageToolbar stack>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as View)}
          className="-mx-4 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <TabsList className="w-max" aria-label="Show">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active" className="whitespace-nowrap">
              Running &amp; queued
              <TabCount value={counts.active} tone="accent" label="active" />
            </TabsTrigger>
            <TabsTrigger value="finished">Finished</TabsTrigger>
            <TabsTrigger value="digests">Check-ins</TabsTrigger>
          </TabsList>
        </Tabs>

        {view !== "digests" ? <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <label htmlFor="work-search" className="sr-only">
              Search work
            </label>
            <Input
              id="work-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks and agents…"
              className="pl-9"
            />
          </div>
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
        </div> : null}
      </PageToolbar>

      <PageBody>
        {view === "digests" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Link href={`/p/${project}/organization#check-in-settings`} className="text-sm text-accent hover:underline">Check-in settings</Link>
            </div>
            <CheckInList project={project} status="all" />
          </div>
        ) : items.isLoading ? (
          <LoadingRows count={4} />
        ) : items.error ? (
          <ErrorState message={errorMessage(items.error)} onRetry={() => void items.refetch()} />
        ) : all.length === 0 && search.trim() ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing here matches "${search.trim()}". Try another word, or clear the search.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : all.length === 0 && view !== "all" ? (
          <EmptyState
            icon={Workflow}
            title={EMPTY[view].title}
            description={EMPTY[view].description}
          />
        ) : all.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="Nothing has run yet"
            description="Press New task to give an agent something to do, or set a schedule in an agent's editor. Everything they do shows up here."
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
          <RunBadge item={item} />
          {item.status === "queued" || item.status === "in_progress" ? <CancelRunButton id={item.id} /> : null}
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
 * Today at a glance: each run's agent placed at its time, a thin accent line
 * for now. Running agents pulse at the line; what is scheduled later waits,
 * faint, to its right. The one live marker on the page.
 */
function TodayStrip({
  items,
  project,
  onSelect,
}: {
  items: ActionItemDto[];
  project: string;
  onSelect?: (id: string) => void;
}) {
  const now = useMinute();
  const [trackWidth, setTrackWidth] = React.useState(360);
  const trackRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.clientWidth || 360);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

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

  // Give nearby marks separate lanes so concurrent runs stay visible at every
  // column width. A lane has room for each marker's 44px pointer target.
  const laneEnds: number[] = [];
  const placed = [...marks]
    .sort((a, b) => a.at - b.at)
    .map(({ item, at }) => {
      const x = ((at - dayStart) / 86_400_000) * trackWidth;
      let lane = laneEnds.findIndex((end) => x - end >= 48);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = x;
      return { item, at, lane };
    });
  const trackHeight = Math.max(44, laneEnds.length * 44);

  return (
    <Panel className="px-5 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Today</h2>
        <p className="text-xs text-ink-muted">{`${marks.length} run${marks.length === 1 ? "" : "s"} today`}</p>
      </div>
      <div
        ref={trackRef}
        role="group"
        className="relative mt-3"
        style={{ height: trackHeight }}
        aria-label="Today’s runs by time"
      >
        <div className="absolute inset-x-0 top-[22px] h-px bg-line" aria-hidden />
        {placed.map(({ item, at, lane }) => (
          <Link
            key={item.id}
            href={`/p/${project}/work/${item.id}`}
            onClick={(event) => {
              if (!onSelect) return;
              event.preventDefault();
              onSelect(item.id);
            }}
            title={`${item.agent.name}: ${runTitle(item)} (${statusLabel(item.status)}, ${formatTime(at)})`}
            aria-label={`${item.agent.name}: ${runTitle(item)}, ${statusLabel(item.status)} at ${formatTime(at)}`}
            className="absolute z-10 flex size-11 -translate-x-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            style={{ left: position(at), top: lane * 44 }}
          >
            <span
              className={cn(
                "rounded-full ring-2 ring-surface",
                item.status === "queued" && "opacity-45",
                item.status === "in_progress" && "outline-2 outline-offset-1 outline-accent motion-safe:animate-pulse",
              )}
            >
              <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" className="size-6" />
            </span>
          </Link>
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
        {level === 2 ? <SectionTab tone="sky">{label}</SectionTab> : label}
        <span className="font-normal text-ink-muted">{count}</span>
      </Heading>
      <Panel className="overflow-hidden">{children}</Panel>
    </section>
  );
}

/**
 * One run, as a row in an inset group: the separator starts past the avatar,
 * as in a native list. Queued work opens like the rest, to show what the
 * agent is set to do and when. On a wide screen a click opens the run in the reading
 * pane; otherwise it opens on its own page. The row's link sits beside the
 * buttons rather than around them, so Remove, Cancel and their dialogs never
 * open the run.
 */
function RunRow({
  item,
  project,
  openSuggestions,
  showStatus = true,
  selected = false,
  onSelect,
}: {
  item: ActionItemDto;
  project: string;
  openSuggestions: number;
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
      <Link
        href={`/p/${project}/work/${item.id}`}
        onClick={open}
        className="absolute inset-0"
        aria-label={`Open: ${title}`}
        aria-current={selected ? "true" : undefined}
      />
      <AgentAvatar
        name={item.agent.name}
        src={item.agent.avatarUrl}
        seed={item.agent.id}
        size="sm"
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-line/70 py-[var(--row-y,0.875rem)] pr-4 group-last/row:border-b-0">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-ink",
              "text-sm font-medium",
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
                : item.status === "needs_approval" && item.awaitingSince
                  ? `waiting ${formatRelativeTime(item.awaitingSince).replace(" ago", "")}`
                  : formatRelativeTime(item.createdAt)}
            {openSuggestions > 0 ? ` · ${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : ""}
          </p>
        </div>
        {/* Beside the reading pane the row stays lean; the pane carries the rest. */}
        {onSelect ? null : <CollabTag item={item} />}
        {/* One state per row: an escalation outranks how the run ended. */}
        {showStatus || isFlagged(item) ? <RunBadge item={item} /> : null}
        <div className="relative z-10 flex items-center gap-1">
          {item.status === "needs_approval" || item.openIssueIds.length > 0 ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/p/${project}/needs-you?item=${item.status === "needs_approval" ? item.id : item.openIssueIds[0]}`}>
                In Needs you
              </Link>
            </Button>
          ) : null}
          {item.status === "in_progress" && !onSelect ? <CancelRunButton id={item.id} /> : null}
          {removable && !onSelect ? (
            <RemoveButton targets={[{ kind: "run", id: item.id }]} what={queued ? "this queued run" : "this run"} />
          ) : null}
        </div>
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
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

/** Running, Paused (waiting on a person, in Needs you) and Queued. */
function groupActive(items: ActionItemDto[]): Group[] {
  return collect(
    items,
    (item) => (item.status === "queued" ? "Queued" : item.status === "needs_approval" ? "Paused" : "Running"),
    ["Running", "Paused", "Queued"],
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
  const [instruction, setInstruction] = React.useState("");

  const fallbackId = defaultAgentId && defaultAgentId !== "all" ? defaultAgentId : (agents[0]?.id ?? "");
  const selectedId = chosenId ?? fallbackId;

  const scope = useScope(selectedId);
  const run = useRunScope(selectedId);
  const selectedAgent = agents.find((a) => a.id === selectedId);

  async function handleStart() {
    if (!selectedId) return;
    try {
      await run.mutateAsync(instruction.trim() || undefined);
      toast.success(`${selectedAgent?.name ?? "The agent"} is on it`, {
        description: "It shows under Running & queued, and under Finished when it is done.",
      });
      setInstruction("");
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
          <span>New task</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Give an agent a task</DialogTitle>
        <DialogDescription>
          It starts right away. Nothing is sent or published without your OK unless you allowed it.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="select-run-agent" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Who should do it?
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

          <div>
            <label htmlFor="run-instruction" className="mb-1.5 block text-xs font-medium text-ink-muted">
              What should {selectedAgent?.name ?? "it"} do? <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              id="run-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="For example: Find three local events we could sponsor this month."
            />
            <p className="mt-1 text-xs text-ink-muted">Leave it empty and it works through its regular goals, below.</p>
          </div>

          {selectedAgent ? (
            <div className="space-y-2 rounded-lg border border-line bg-surface-2/50 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-ink">
                <AgentAvatar name={selectedAgent.name} src={selectedAgent.avatarUrl} seed={selectedAgent.id} size="sm" />
                <span>{selectedAgent.name}</span>
                <span className="text-ink-muted">
                  · {scope.data?.autonomy === "auto" ? "Sends on its own" : "Asks before sending"}
                </span>
              </div>
              {scope.data?.objectives && scope.data.objectives.length > 0 ? (
                <div>
                  <span className="mb-1 block text-ink-muted">Regular goals:</span>
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
                  No goals written yet. It works from its job description.
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
            Start now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
