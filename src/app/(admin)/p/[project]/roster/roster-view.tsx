"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bug,
  FileText,
  MessageSquare,
  Plus,
  Search,
  UserRoundPlus,
} from "lucide-react";
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
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
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
            className="pl-9"
          />
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
        {isPending ? (
          <LoadingRows count={3} />
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : agents!.length === 0 ? (
          <EmptyState
            icon={UserRoundPlus}
            title="No one on the roster yet"
            description="Hire your first AI employee for this project: give them a name, a job, and the documents they need. It takes about five minutes."
            action={
              <Button asChild size="lg">
                <Link href={`/p/${project}/agents/new`}>
                  <Plus aria-hidden />
                  Create your first agent
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
  // `relative` is load-bearing: the title below uses a stretched link
  // (`after:absolute inset-0`) to make the whole card clickable, and without a
  // positioned ancestor that hit area escapes the card and covers unrelated
  // controls elsewhere on the page.
  return (
    <Panel className="group relative h-full transition-shadow hover:shadow-md focus-within:shadow-md">
      <div className="flex h-full flex-col p-4">
        <div className="flex items-start gap-3">
          <AgentAvatar name={agent.name} src={agent.avatarUrl} seed={agent.id} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[0.9375rem] font-semibold text-ink">
              {/* Stretched link: the whole card is the click target, but the
                  accessible name stays the agent's name. */}
              <Link
                href={`/p/${project}/agents/${agent.id}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {agent.name}
              </Link>
            </h2>
            <p className="truncate text-[0.8125rem] text-ink-muted">{agent.jobTitle}</p>
            {agent.department ? (
              <p className="mt-0.5 truncate text-xs text-ink-subtle">
                {agent.department}
              </p>
            ) : null}
          </div>
          <StatusBadge status={agent.status} />
        </div>

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-ink-subtle" aria-hidden />
            <dt className="sr-only">Conversations</dt>
            <dd className="tabular-nums">{agent.conversationCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-ink-subtle" aria-hidden />
            <dt className="sr-only">Context documents</dt>
            <dd className="tabular-nums">{agent.documentCount}</dd>
          </div>
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

        <p className="mt-auto pt-3 meta">
          Updated {formatRelativeTime(agent.updatedAt)}
        </p>
      </div>
    </Panel>
  );
}
