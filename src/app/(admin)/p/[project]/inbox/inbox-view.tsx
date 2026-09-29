"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  BotMessageSquare,
  CheckCircle2,
  Inbox as InboxIcon,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { ApprovalCard } from "@/components/work/approval-card";
import { DigestCard } from "@/components/work/digest-card";
import { SuggestionRow } from "@/components/work/suggestion-row";
import { RemoveButton } from "@/components/work/row-actions";
import type { RemoveTarget } from "@/hooks/use-work-data";
import { useActionItems, useDigests, useSuggestions } from "@/hooks/use-work-data";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ListRow, RowIcon } from "@/components/ui/list-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TabCount, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import {
  useAgents,
  useConversations,
  useIssues,
  useSetIssueStatus,
} from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import type { ConversationSummaryDto, IssueDto } from "@/lib/serialize";
import { ISSUE_KINDS, issueKind } from "@/lib/issue-kinds";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";


/** What Active and Done mean on each tab, in the status words its API speaks. */
const STATUS_FOR = {
  conversations: { active: "active", done: "resolved" },
  approvals: { active: "all", done: "all" },
  issues: { active: "open", done: "resolved" },
  suggestions: { active: "open", done: "resolved" },
  updates: { active: "unread", done: "read" },
} as const;

function DoneEmpty({ what }: { what: string }) {
  return (
    <EmptyState
      icon={CheckCircle2}
      title="Nothing here yet"
      description={`${what} move here once they are dealt with, so the Active list only holds what still needs you.`}
    />
  );
}

/** Empties the Done list on screen - only what is shown, so a search or agent filter narrows it. */
function ClearAll({ targets, noun }: { targets: RemoveTarget[]; noun: string }) {
  return (
    <div className="flex justify-end">
      <RemoveButton
        targets={targets}
        what={`${targets.length} ${noun}${targets.length === 1 ? "" : "s"}`}
        label="Clear all"
      />
    </div>
  );
}

const INBOX_TABS = ["conversations", "approvals", "issues", "suggestions", "updates"] as const;
type InboxTab = (typeof INBOX_TABS)[number];

export function InboxView({ project, initialTab }: { project: string; initialTab?: string }) {
  // Tabs are ordered by usage frequency: Conversations is first, followed by Approvals, Issues, Suggestions, and Updates.
  // ?tab= opens another one, so a link can land on what it points at.
  const [tab, setTab] = React.useState<InboxTab>(() =>
    (INBOX_TABS as readonly string[]).includes(initialTab ?? "") ? (initialTab as InboxTab) : "conversations",
  );

  // Only counted here; the Approvals tab fetches the full items it renders.
  const awaiting = useActionItems({ project, status: "needs_approval", view: "list" }, { refetchInterval: 10_000 });
  const openConversations = useConversations({ project, status: "open" });
  const openIssues = useIssues({ project, status: "open" });
  const openSuggestions = useSuggestions({ project, status: "open" });
  const unreadDigests = useDigests({ project, status: "unread" });

  const counts = React.useMemo(() => {
    const rawOpenIssues = (openIssues.data ?? []).filter((i) => i.type !== "suggestion").length;
    const rawSuggestions = (openSuggestions.data ?? []).filter((s) => s.pending).length;
    const issueSuggestions = (openIssues.data ?? []).filter((i) => i.type === "suggestion").length;

    return {
      conversations: openConversations.data?.length ?? 0,
      approvals: awaiting.data?.length ?? 0,
      issues: rawOpenIssues,
      suggestions: rawSuggestions + issueSuggestions,
      updates: unreadDigests.data?.length ?? 0,
    };
  }, [openIssues.data, openSuggestions.data, openConversations.data, awaiting.data, unreadDigests.data]);

  const [agentId, setAgentId] = React.useState("all");
  // Active is the working inbox; Done is where resolved, dismissed and read
  // things go, so they stop crowding what still needs you.
  const [view, setView] = React.useState<"active" | "done">("active");
  const status = STATUS_FOR[tab][view];
  const [includePreviews, setIncludePreviews] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Debounced, so typing does not fire a query per keystroke.
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: agents } = useAgents(project);

  const filters = React.useMemo(
    () => ({
      project,
      agentId,
      status,
      q: query,
      includePreviews: includePreviews ? "true" : "",
    }),
    [project, agentId, status, query, includePreviews],
  );

  const showSearch = tab === "conversations" || tab === "issues" || tab === "suggestions";
  const showPreviews = tab === "conversations" || tab === "issues";

  return (
    <Page>
      <PageHeader
        title="Inbox"
        description="Everything your agents have handled, action items awaiting review, and feedback."
      />

      <PageToolbar stack>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
          className="-mx-4 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <TabsList className="w-max">
            <TabsTrigger value="conversations">
              Conversations
              <TabCount value={counts.conversations} tone="accent" label="open" />
            </TabsTrigger>
            <TabsTrigger value="approvals">
              Approvals
              <TabCount value={counts.approvals} tone="warning" label="waiting" />
            </TabsTrigger>
            <TabsTrigger value="issues" className="whitespace-nowrap">
              Issues
              <TabCount value={counts.issues} tone="danger" label="open" />
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="whitespace-nowrap">
              Suggestions
              <TabCount value={counts.suggestions} tone="accent" label="open" />
            </TabsTrigger>
            <TabsTrigger value="updates">
              Updates
              <TabCount value={counts.updates} tone="accent" label="unread" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          {showSearch ? (
            <div className="relative w-full sm:w-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <label htmlFor="inbox-search" className="sr-only">
                Search
              </label>
              <Input
                id="inbox-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  tab === "conversations"
                    ? "Search transcripts…"
                    : tab === "issues"
                      ? "Search issues…"
                      : "Search suggestions…"
                }
                className="pl-9"
              />
            </div>
          ) : null}

          <div className="w-44">
            <label htmlFor="inbox-agent" className="sr-only">
              Filter by agent
            </label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="inbox-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {(agents ?? []).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tab !== "approvals" ? (
            <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
              <TabsList aria-label="Show active or done">
                <TabsTrigger value="active" className="px-3 py-1 text-xs">
                  Active
                </TabsTrigger>
                <TabsTrigger value="done" className="px-3 py-1 text-xs">
                  Done
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          {showPreviews ? (
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <Switch
                checked={includePreviews}
                onCheckedChange={setIncludePreviews}
                aria-label="Include builder preview chats"
              />
              Include previews
            </label>
          ) : null}
        </div>
      </PageToolbar>

      <PageBody>
        {tab === "conversations" ? (
          <ConversationList filters={filters} project={project} />
        ) : tab === "approvals" ? (
          <ApprovalList project={project} agentId={agentId} />
        ) : tab === "issues" ? (
          <IssueList filters={filters} project={project} />
        ) : tab === "suggestions" ? (
          <SuggestionList filters={filters} project={project} />
        ) : (
          <UpdatesList project={project} agentId={agentId} status={status} />
        )}
      </PageBody>
    </Page>
  );
}

function ConversationList({
  filters,
  project,
}: {
  filters: Record<string, string>;
  project: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useConversations(filters);

  if (isPending) return <LoadingRows count={4} />;
  if (error) {
    return (
      <ErrorState
        message={errorMessage(error)}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }
  if (data!.length === 0) {
    return filters.q ? (
      <EmptyState
        icon={Search}
        title="Nothing matches that search"
        description={`No transcript or summary in this project contains “${filters.q}”.`}
      />
    ) : filters.status === "resolved" ? (
      <DoneEmpty what="Resolved conversations" />
    ) : (
      <EmptyState
        icon={InboxIcon}
        title="No conversations yet"
        description="Once a client opens a published agent's link or widget and sends a message, the transcript lands here."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {filters.status === "resolved" ? (
        <ClearAll
          targets={data!.map((conversation) => ({ kind: "conversation" as const, id: conversation.id }))}
          noun="conversation"
        />
      ) : null}
      <Panel className="overflow-hidden">
        <ul>
          {data!.map((conversation) => (
            <li key={conversation.id} className="group/row">
              <ConversationRow conversation={conversation} project={project} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function ConversationRow({
  conversation,
  project,
}: {
  conversation: ConversationSummaryDto;
  project: string;
}) {
  return (
    <ListRow
      leading={
        <div className="relative">
          <AgentAvatar
            name={conversation.agent.name}
            src={conversation.agent.avatarUrl}
            seed={conversation.agent.id}
            size="md"
            className="ring-2 ring-line/50"
          />
          {conversation.status === "open" ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-surface"
              aria-hidden
            />
          ) : null}
        </div>
      }
      title={
        <Link
          href={`/p/${project}/inbox/${conversation.id}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {conversation.agent.name}
        </Link>
      }
      badges={
        <>
          <StatusBadge status={conversation.status} />
          {conversation.mode === "human" ? (
            <Badge tone="warning">
              <UserRound aria-hidden />
              {conversation.takenOverBy ? `${conversation.takenOverBy} replying` : "Human replying"}
            </Badge>
          ) : null}
          {conversation.openIssueCount > 0 ? (
            <Badge tone="danger">
              <AlertCircle aria-hidden />
              {conversation.openIssueCount} open
            </Badge>
          ) : conversation.issueCount > 0 ? (
            <Badge tone="neutral">{conversation.issueCount} logged</Badge>
          ) : null}
        </>
      }
      body={
        conversation.summary ? (
          <p className="line-clamp-2 text-ink">{conversation.summary}</p>
        ) : (
          <p className="line-clamp-2 text-ink-muted">{conversation.preview || "No client message yet."}</p>
        )
      }
      meta={
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2/70 px-2 py-0.5 text-xs text-ink-muted">
          <BotMessageSquare className="size-3 text-ink-subtle" aria-hidden />
          {conversation.messageCount} messages
        </span>
      }
      aside={
        <span title={formatDateTime(conversation.lastMessageAt)}>
          {formatTime(conversation.lastMessageAt)} · {formatRelativeTime(conversation.lastMessageAt)}
        </span>
      }
      trailing={<RemoveButton targets={[{ kind: "conversation", id: conversation.id }]} what="this conversation" />}
    />
  );
}

/**
 * The Issues tab: reported bugs, problems, run failures, and escalations.
 */
function IssueList({
  filters,
  project,
}: {
  filters: Record<string, string>;
  project: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useIssues(filters);
  const setStatus = useSetIssueStatus();

  const filteredIssues = React.useMemo(() => {
    const query = (filters.q ?? "").toLowerCase();
    return (data ?? [])
      .filter((issue) => issue.type !== "suggestion")
      .filter((issue) =>
        query
          ? [issue.summary, issue.details ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true,
      );
  }, [data, filters.q]);

  if (isPending) return <LoadingRows count={4} />;
  if (error) {
    return (
      <ErrorState
        message={errorMessage(error)}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }
  if (filteredIssues.length === 0) {
    return filters.q ? (
      <EmptyState
        icon={Search}
        title="Nothing matches that search"
        description={`No issue in this project contains “${filters.q}”.`}
      />
    ) : filters.status === "resolved" ? (
      <DoneEmpty what="Resolved issues" />
    ) : (
      <EmptyState
        icon={CheckCircle2}
        title="No issues found"
        description="When a client reports a problem, an agent hits its escalation rule, or an autonomous task stops, it appears here immediately."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {filters.status === "resolved" ? (
        <ClearAll targets={filteredIssues.map((issue) => ({ kind: "issue" as const, id: issue.id }))} noun="issue" />
      ) : null}
      <Panel className="overflow-hidden">
        <ul>
          {filteredIssues.map((issue) => (
            <li key={`issue-${issue.id}`} className="group/row">
              <IssueRow
                issue={issue}
                project={project}
                pending={setStatus.isPending && setStatus.variables?.issueId === issue.id}
                onToggle={() =>
                  setStatus.mutate({
                    issueId: issue.id,
                    status: issue.status === "open" ? "resolved" : "open",
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
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
          <span>{issue.source === "agent" ? "Raised by the agent" : "Raised by a client"}</span>
          <span aria-hidden>·</span>
          {issue.conversationId ? (
            <Link href={`/p/${project}/inbox/${issue.conversationId}`} className="text-accent hover:underline">
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

/**
 * The Suggestions tab: agent-initiated proposals, recommendations from autonomous runs,
 * and ideas raised by agents or clients.
 */
function SuggestionList({
  filters,
  project,
}: {
  filters: Record<string, string>;
  project: string;
}) {
  const suggestions = useSuggestions({ project, agentId: filters.agentId ?? "all" });
  const {
    data: issueData,
    isPending: issuePending,
    error: issueError,
    refetch: issueRefetch,
    isRefetching: issueRefetching,
  } = useIssues(filters);
  const setStatus = useSetIssueStatus();

  const shownSuggestions = React.useMemo(() => {
    const status = filters.status;
    const query = (filters.q ?? "").toLowerCase();
    return (suggestions.data ?? [])
      .filter((suggestion) =>
        status === "open" ? suggestion.pending : status === "resolved" ? !suggestion.pending : true,
      )
      .filter((suggestion) =>
        query
          ? [suggestion.summary, suggestion.rationale, suggestion.proposal]
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true,
      );
  }, [suggestions.data, filters.status, filters.q]);

  const shownIssueSuggestions = React.useMemo(() => {
    const query = (filters.q ?? "").toLowerCase();
    return (issueData ?? [])
      .filter((issue) => issue.type === "suggestion")
      .filter((issue) =>
        query
          ? [issue.summary, issue.details ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true,
      );
  }, [issueData, filters.q]);

  if (suggestions.isPending || issuePending) return <LoadingRows count={4} />;
  if (suggestions.error || issueError) {
    return (
      <ErrorState
        message={errorMessage(suggestions.error ?? issueError)}
        onRetry={() => {
          if (suggestions.error) void suggestions.refetch();
          if (issueError) void issueRefetch();
        }}
        retrying={suggestions.isRefetching || issueRefetching}
      />
    );
  }

  if (shownSuggestions.length === 0 && shownIssueSuggestions.length === 0) {
    return filters.q ? (
      <EmptyState
        icon={Search}
        title="Nothing matches that search"
        description={`No suggestion in this project contains “${filters.q}”.`}
      />
    ) : filters.status === "resolved" ? (
      <DoneEmpty what="Accepted, dismissed and snoozed suggestions" />
    ) : (
      <EmptyState
        icon={Sparkles}
        title="Nothing waiting for review"
        description="When an agent proposes an objective, identifies an improvement idea, or recommends a next step, it lands here for you to accept, snooze, or dismiss."
      />
    );
  }

  const rows = [
    ...shownSuggestions.map((suggestion) => ({
      key: `suggestion-${suggestion.id}`,
      at: suggestion.createdAt,
      node: <SuggestionRow suggestion={suggestion} project={project} />,
    })),
    ...shownIssueSuggestions.map((issue) => ({
      key: `issue-suggestion-${issue.id}`,
      at: issue.createdAt,
      node: (
        <IssueRow
          issue={issue}
          project={project}
          pending={setStatus.isPending && setStatus.variables?.issueId === issue.id}
          onToggle={() =>
            setStatus.mutate({
              issueId: issue.id,
              status: issue.status === "open" ? "resolved" : "open",
            })
          }
        />
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-2.5">
      {filters.status === "resolved" ? (
        <ClearAll
          targets={[
            ...shownSuggestions.map((suggestion) => ({ kind: "suggestion" as const, id: suggestion.id })),
            ...shownIssueSuggestions.map((issue) => ({ kind: "issue" as const, id: issue.id })),
          ]}
          noun="suggestion"
        />
      ) : null}
      <Panel className="overflow-hidden">
        <ul>
          {rows.map((row) => (
            <li key={row.key} className="group/row">
              {row.node}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/**
 * The Updates tab: periodic digests and reports agents write on their own cadence.
 */
function UpdatesList({
  project,
  agentId,
  status,
}: {
  project: string;
  agentId: string;
  status: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useDigests({
    project,
    agentId,
    status: status === "unread" || status === "read" ? status : "all",
  });

  if (isPending) return <LoadingRows count={3} />;
  if (error) {
    return (
      <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} retrying={isRefetching} />
    );
  }
  if (data!.length === 0) {
    return status === "unread" ? (
      <EmptyState
        icon={CheckCircle2}
        title="You're up to date"
        description="Every update your agents have sent has been read. New ones arrive on each agent's digest cadence - weekly by default."
      />
    ) : status === "read" ? (
      <DoneEmpty what="Updates you have read" />
    ) : (
      <EmptyState
        icon={Radio}
        title="No updates yet"
        description="Each agent writes you a short update on its own cadence - what it got done, what is pending, and anything it thinks you should know. Set the cadence in an agent's scope of work, or press Send one now there to see one immediately."
      />
    );
  }

  return (
    <div className="space-y-3">
      {status === "read" ? (
        <ClearAll targets={data!.map((digest) => ({ kind: "update" as const, id: digest.id }))} noun="update" />
      ) : null}
      {data!.map((digest) => (
        <DigestCard key={digest.id} digest={digest} project={project} />
      ))}
    </div>
  );
}

function ApprovalList({ project, agentId }: { project: string; agentId: string }) {
  const { data, isPending, error, refetch, isRefetching } = useActionItems(
    { project, status: "needs_approval", agentId: agentId === "all" ? undefined : agentId },
    { refetchInterval: 5_000 },
  );

  if (isPending) return <LoadingRows count={3} />;
  if (error) {
    return (
      <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} retrying={isRefetching} />
    );
  }
  if (data!.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing waiting for approval"
        description="When an agent is ready to send an email, publish a post, add a calendar event or post to Slack, it lands here first, exactly as it would go out, for you to approve, edit or reject."
      />
    );
  }
  return (
    <div className="space-y-3">
      {data!.map((item) => (
        <ApprovalCard key={item.id} item={item} project={project} />
      ))}
    </div>
  );
}
