"use client";

import * as React from "react";
import Link from "next/link";
import { Bug, CalendarClock, FileText, Hand, MessageSquare, Pause, Plus, Search, UserRoundPlus, Zap } from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingCards } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
import { ProjectContextPanel } from "@/components/builder/project-context-panel";
import { SetupChecklist } from "@/components/help/setup-checklist";
import { errorMessage } from "@/lib/api-client";
import type { AgentSummaryDto } from "@/lib/serialize";
import { formatRelativeTime } from "@/lib/utils";

export function RosterView({ project }: { project: string }) {
  const { data: agents, isPending, error, refetch, isRefetching } = useAgents(project);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [department, setDepartment] = React.useState("all");

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents ?? []) if (agent.department) set.add(agent.department);
    return [...set].sort();
  }, [agents]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return (agents ?? []).filter((agent) => {
      if (status !== "all" && agent.status !== status) return false;
      if (department !== "all" && agent.department !== department) return false;
      if (!term) return true;
      return [agent.name, agent.jobTitle, agent.department ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [agents, search, status, department]);

  return (
    <Page>
      <PageHeader
        title="Roster"
        description="Everyone on your AI staff. Published agents are reachable by clients; drafts are not."
        actions={
          <Button asChild>
            <Link href={`/p/${project}/agents/new`}>
              <Plus aria-hidden />
              New agent
            </Link>
          </Button>
        }
      />

      {/* Same toolbar as the inbox, so the first row of content sits at the
          same height on both tabs. */}
      <PageToolbar>
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <label htmlFor="roster-search" className="sr-only">
            Search the roster
          </label>
          <Input
            id="roster-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, title or team…"
            className="pl-9 pr-10"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle shadow-2xs">
              /
            </kbd>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-36">
            <label htmlFor="roster-status" className="sr-only">
              Filter by status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="roster-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {departments.length > 0 ? (
            <div className="w-40">
              <label htmlFor="roster-department" className="sr-only">
                Filter by team
              </label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="roster-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {departments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </PageToolbar>

      <PageBody>
        {/* First the four things that make a workspace work, then the
            company context every agent below inherits. */}
        <SetupChecklist project={project} />
        <ProjectContextPanel project={project} />

        {isPending ? (
          <LoadingCards />
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : agents!.length === 0 ? (
          <EmptyState
            icon={UserRoundPlus}
            title="Nobody on the roster yet"
            description="An AI employee answers your clients and, once you trust it, does work on its own. Hiring the first one takes about five minutes."
            action={
              <Button asChild>
                <Link href={`/p/${project}/agents/new`}>
                  <Plus aria-hidden />
                  Hire your first agent
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <p className="meta" aria-live="polite">
              {filtered.length} of {agents!.length} agents
            </p>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No agents match those filters"
                description="Try a different search term, or clear the filters to see everyone on the roster."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                      setDepartment("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((agent) => (
                  <li key={agent.id}>
                    <AgentCard agent={agent} project={project} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PageBody>
    </Page>
  );
}

function AgentCard({ agent, project }: { agent: AgentSummaryDto; project: string }) {
  const live = agent.status === "published";
  // `relative` is load-bearing: the title below uses a stretched link
  // (`after:absolute inset-0`) to make the whole card clickable, and without a
  // positioned ancestor that hit area escapes the card and covers unrelated
  // controls elsewhere on the page.
  return (
    <Panel className="group relative flex h-full flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-within:border-line-strong focus-within:shadow-md">
      {/* Name and role carry the hierarchy; status sits apart, top right. */}
      <div className="flex items-start gap-3.5 p-5 pb-3.5">
        <div className="relative shrink-0">
          <AgentAvatar
            name={agent.name}
            src={agent.avatarUrl}
            seed={agent.id}
            size="lg"
            className="ring-2 ring-line/50 transition-transform duration-200 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
            <Link
              href={`/p/${project}/agents/${agent.id}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {agent.name}
            </Link>
          </h2>
          <p className="mt-1 truncate text-sm text-ink-muted">{agent.jobTitle}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {/* What it has done, in words, not icons. */}
      <dl className="mx-5 flex flex-wrap gap-2 border-t border-line py-3 text-xs text-ink-muted">
        <div className="flex items-center gap-1.5 rounded-md bg-surface-2/60 px-2.5 py-1">
          <MessageSquare className="size-3.5 text-ink-subtle" aria-hidden />
          <dt className="sr-only">Conversations</dt>
          <dd>
            <span className="font-semibold tabular-nums text-ink">{agent.conversationCount}</span>{" "}
            conversation{agent.conversationCount === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-surface-2/60 px-2.5 py-1">
          <FileText className="size-3.5 text-ink-subtle" aria-hidden />
          <dt className="sr-only">Context documents</dt>
          <dd>
            <span className="font-semibold tabular-nums text-ink">{agent.documentCount}</span>{" "}
            document{agent.documentCount === 1 ? "" : "s"}
          </dd>
        </div>
        <RunsOnItsOwn runs={agent.runs} />
        {agent.openIssueCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Open issues</dt>
            <dd>
              <Badge tone="danger">
                <Bug aria-hidden />
                {agent.openIssueCount} open
              </Badge>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto flex items-center justify-between rounded-b-panel border-t border-line/40 bg-surface-2/30 px-5 py-3">
        <p className="meta min-w-0 truncate">
          {agent.department ? `${agent.department} · ` : ""}
          Updated {formatRelativeTime(agent.updatedAt)}
        </p>
        <span className="text-xs font-semibold text-accent opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-within:opacity-100">
          {live ? "Open editor →" : "Finish setting up →"}
        </span>
      </div>
    </Panel>
  );
}

/** Whether the agent works without anyone opening the app, and when. */
function RunsOnItsOwn({ runs }: { runs: AgentSummaryDto["runs"] }) {
  const view = {
    scheduled: { icon: CalendarClock, tone: "positive", label: runs.cadence ?? "Scheduled" },
    triggered: { icon: Zap, tone: "positive", label: "Runs when triggered" },
    paused: { icon: Pause, tone: "warning", label: "Trigger paused" },
    manual: { icon: Hand, tone: "neutral", label: "Only when you run it" },
  } as const;
  const { icon: Icon, tone, label } = view[runs.mode];
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="sr-only">How it runs</dt>
      <dd className="min-w-0">
        <Badge tone={tone} className="max-w-full">
          <Icon aria-hidden />
          <span className="truncate">{label}</span>
        </Badge>
      </dd>
    </div>
  );
}
