"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Search,
  Sparkles,
  TriangleAlert,
  Undo2,
  UserRoundCheck,
} from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ListRow, RowIcon } from "@/components/ui/list-row";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabCount, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { ApprovalCard } from "@/components/work/approval-card";
import { RemoveButton } from "@/components/work/row-actions";
import { SuggestionRow } from "@/components/work/suggestion-row";
import { useSpaceKind } from "@/components/space-kind";
import { useAgents, useIssues, useSetIssueStatus } from "@/hooks/use-admin-data";
import { useActionItems, useSuggestions, type RemoveTarget } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { IssueDto } from "@/lib/serialize";
import type { ActionItemDto, SuggestionDto } from "@/lib/work/serialize";
import { ISSUE_KINDS, issueKind } from "@/lib/issue-kinds";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { needsYouKind, NEEDS_YOU_KINDS, type NeedsYouKind } from "@/lib/needs-you";

type Entry =
  | { kind: "approval"; id: string; at: string; item: ActionItemDto }
  | { kind: "question"; id: string; at: string; suggestion: SuggestionDto }
  | { kind: Exclude<NeedsYouKind, "approval" | "question">; id: string; at: string; issue: IssueDto };

const LABELS: Record<NeedsYouKind, string> = {
  approval: "Approvals",
  escalation: "Escalations",
  failure: "Failures",
  question: "Questions",
  reported: "Reported",
};

/**
 * Needs you: the one place a person goes for everything that needs them.
 *
 * Approvals (an email, a post, an event waiting for a yes), escalations (an
 * agent stopped and asked), failures (a run that could not finish), questions
 * (an agent proposing a next step) and what was reported in a chat - one
 * queue, most urgent kind first, newest first within it. Every decision is
 * made here and only here: Work and the run pages point back to this list.
 */
export interface NeedsYouViewProps {
  project: string;
  focus: string | null;
  initialAgentId?: string;
}

export function NeedsYouView({
  project,
  focus,
  initialAgentId,
}: NeedsYouViewProps) {
  const personal = useSpaceKind() === "personal";
  const [kind, setKind] = React.useState<NeedsYouKind | "all">("all");
  const [view, setView] = React.useState<"waiting" | "handled">("waiting");
  const [agentId, setAgentId] = React.useState(initialAgentId ?? "all");
  const [prevInitialAgentId, setPrevInitialAgentId] = React.useState(initialAgentId);
  if (initialAgentId !== prevInitialAgentId) {
    setPrevInitialAgentId(initialAgentId);
    setAgentId(initialAgentId ?? "all");
  }
  const [search, setSearch] = React.useState("");
  const agent = agentId === "all" ? undefined : agentId;
  const { data: agents } = useAgents(project);

  const approvals = useActionItems({ project, status: "needs_approval", agentId: agent }, { refetchInterval: 5_000 });
  const issues = useIssues({ project, ...(agent ? { agentId: agent } : {}), status: view === "waiting" ? "open" : "resolved" });
  const suggestions = useSuggestions({ project, ...(agent ? { agentId: agent } : {}) });
  const setIssueStatus = useSetIssueStatus();

  const entries = React.useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    if (view === "waiting") {
      for (const item of approvals.data ?? []) {
        list.push({ kind: "approval", id: item.id, at: item.awaitingSince ?? item.createdAt, item });
      }
    }
    for (const suggestion of suggestions.data ?? []) {
      if (suggestion.pending === (view === "waiting")) {
        list.push({ kind: "question", id: suggestion.id, at: suggestion.createdAt, suggestion });
      }
    }
    for (const issue of issues.data ?? []) {
      const k = needsYouKind(issue);
      list.push({ kind: k, id: issue.id, at: issue.createdAt, issue } as Entry);
    }
    const q = search.trim().toLowerCase();
    const text = (entry: Entry) =>
      entry.kind === "approval"
        ? `${entry.item.headline ?? ""} ${entry.item.summary ?? ""} ${entry.item.agent.name}`
        : entry.kind === "question"
          ? `${entry.suggestion.summary} ${entry.suggestion.rationale} ${entry.suggestion.proposal} ${entry.suggestion.agent.name}`
          : `${entry.issue.summary} ${entry.issue.details ?? ""} ${entry.issue.agent?.name ?? ""}`;
    return list
      .filter((entry) => !q || text(entry).toLowerCase().includes(q))
      .sort((a, b) => NEEDS_YOU_KINDS.indexOf(a.kind) - NEEDS_YOU_KINDS.indexOf(b.kind) || b.at.localeCompare(a.at));
  }, [view, approvals.data, suggestions.data, issues.data, search]);

  const counts = React.useMemo(() => {
    const map = Object.fromEntries(NEEDS_YOU_KINDS.map((k) => [k, 0])) as Record<NeedsYouKind, number>;
    for (const entry of entries) map[entry.kind]++;
    return map;
  }, [entries]);
  const shown = kind === "all" ? entries : entries.filter((entry) => entry.kind === kind);

  // A link to one item (from a run page, an email) scrolls to it.
  React.useEffect(() => {
    if (!focus) return;
    const node = document.getElementById(`needs-${focus}`);
    node?.scrollIntoView({ block: "center" });
  }, [focus, shown.length]);

  const loading = approvals.isPending || issues.isPending || suggestions.isPending;
  const error = approvals.error ?? issues.error ?? suggestions.error;

  return (
    <Page>
      <PageHeader
        title="Needs you"
        description={
          personal
            ? "Everything your assistants are waiting on you for, in one place: what to approve, what they flagged, what failed, and what they suggest."
            : "Everything that needs a person, in one place: approvals, escalations, failed runs, agents' questions and problems reported in chats."
        }
      />

      <PageToolbar stack>
        <Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)} className="-mx-4 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max" aria-label="Show">
            <TabsTrigger value="all">
              All
              <TabCount value={entries.length} tone="warning" label={view} />
            </TabsTrigger>
            {NEEDS_YOU_KINDS.filter((k) => !(personal && k === "reported")).map((k) => (
              <TabsTrigger key={k} value={k} className="whitespace-nowrap">
                {LABELS[k]}
                <TabCount value={counts[k]} tone={k === "approval" ? "warning" : k === "question" ? "accent" : "danger"} label={view} />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <label htmlFor="needs-search" className="sr-only">
              Search
            </label>
            <Input id="needs-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" className="pl-9" />
          </div>
          <div className="w-44">
            <label htmlFor="needs-agent" className="sr-only">
              Filter by agent
            </label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="needs-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{personal ? "All assistants" : "All agents"}</SelectItem>
                {(agents ?? []).map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
            <TabsList aria-label="Show waiting or handled">
              <TabsTrigger value="waiting" className="px-3 py-1 text-xs">
                Waiting
              </TabsTrigger>
              <TabsTrigger value="handled" className="px-3 py-1 text-xs">
                Handled
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PageToolbar>

      <PageBody>
        {loading ? (
          <LoadingRows count={4} />
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => {
              void approvals.refetch();
              void issues.refetch();
              void suggestions.refetch();
            }}
          />
        ) : shown.length === 0 ? (
          search.trim() ? (
            <EmptyState icon={Search} title="Nothing matches that search" description={`Nothing here contains “${search.trim()}”.`} />
          ) : view === "handled" ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing handled yet"
              description="Resolved flags and decided suggestions move here. Approved and rejected work is under Work, on each run."
            />
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing needs you"
              description="When something is ready for your yes, an agent stops and asks, a run fails, or an agent proposes a next step, it lands here - and only here."
            />
          )
        ) : (
          <div className="space-y-3">
            {view === "handled" ? (
              <div className="flex justify-end">
                <RemoveButton
                  targets={shown.flatMap((entry): RemoveTarget[] =>
                    entry.kind === "question"
                      ? [{ kind: "suggestion", id: entry.id }]
                      : entry.kind === "approval"
                        ? []
                        : [{ kind: "issue", id: entry.id }],
                  )}
                  what={`${shown.length} handled item${shown.length === 1 ? "" : "s"}`}
                  label="Clear all"
                />
              </div>
            ) : null}
            {shown.map((entry) => (
              <div
                key={`${entry.kind}-${entry.id}`}
                id={`needs-${entry.id}`}
                className={focus === entry.id ? "rounded-panel ring-2 ring-accent ring-offset-2 ring-offset-paper" : undefined}
              >
                {entry.kind === "approval" ? (
                  <ApprovalCard item={entry.item} project={project} />
                ) : entry.kind === "question" ? (
                  <Panel className="overflow-hidden px-1">
                    <SuggestionRow suggestion={entry.suggestion} project={project} />
                  </Panel>
                ) : (
                  <Panel className="group/row overflow-hidden">
                    <IssueRow
                      issue={entry.issue}
                      project={project}
                      pending={setIssueStatus.isPending && setIssueStatus.variables?.issueId === entry.issue.id}
                      onToggle={() =>
                        setIssueStatus.mutate({
                          issueId: entry.issue.id,
                          status: entry.issue.status === "open" ? "resolved" : "open",
                        })
                      }
                    />
                  </Panel>
                )}
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  );
}

function IssueRow({
  issue,
  project,
  pending,
  onToggle,
}: {
  issue: IssueDto;
  project: string;
  pending: boolean;
  onToggle: () => void;
}) {
  const resolved = issue.status === "resolved";
  const kind = ISSUE_KINDS[issueKind(issue.type)];
  const Icon = { bug: AlertCircle, lightbulb: Sparkles, handoff: UserRoundCheck, alert: TriangleAlert }[kind.icon];

  return (
    // Mail's shape: who it is from on top (the agent, with their face), then
    // what it is about, then the detail.
    <ListRow
      muted={resolved}
      leading={
        issue.agent ? (
          <AgentAvatar name={issue.agent.name} src={issue.agent.avatarUrl} seed={issue.agent.id} size="md" />
        ) : (
          <RowIcon>
            <Icon />
          </RowIcon>
        )
      }
      title={issue.agent?.name ?? "Unassigned"}
      aside={<span title={formatDateTime(issue.createdAt)}>{formatRelativeTime(issue.createdAt)}</span>}
      body={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium text-ink">{issue.summary}</p>
            <Badge tone={kind.tone}>
              <Icon aria-hidden />
              {kind.label}
            </Badge>
            {issue.type === "escalation" ? null : <SeverityBadge severity={issue.severity} />}
            {resolved ? <StatusBadge status="resolved" /> : null}
          </div>
          {issue.details ? <p className="line-clamp-3 whitespace-pre-wrap text-ink-muted">{issue.details}</p> : null}
        </div>
      }
      meta={
        <>
          <span>{issue.source === "agent" ? "Raised by the agent" : "Raised in a chat"}</span>
          <span aria-hidden>·</span>
          {issue.conversationId ? (
            <Link href={`/p/${project}/conversations/${issue.conversationId}`} className="text-accent hover:underline">
              View conversation
            </Link>
          ) : issue.actionItemId ? (
            <Link href={`/p/${project}/work/${issue.actionItemId}`} className="text-accent hover:underline">
              View the run
            </Link>
          ) : null}
        </>
      }
      trailing={
        <div className="flex items-center gap-1">
          <Button variant={resolved ? "ghost" : "secondary"} size="sm" loading={pending} onClick={onToggle}>
            {resolved ? (
              <>
                <Undo2 aria-hidden />
                Reopen
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden />
                Resolve
              </>
            )}
          </Button>
          {/* Resolving is the everyday move; removing is for tidying up what is done. */}
          {resolved ? <RemoveButton targets={[{ kind: "issue", id: issue.id }]} what="this issue" /> : null}
        </div>
      }
    />
  );
}
