"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bug,
  CheckCircle2,
  ClipboardCheck,
  Inbox as InboxIcon,
  Lightbulb,
  MessageSquare,
  Newspaper,
  Search,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { ApprovalCard } from "@/components/work/approval-card";
import { DigestCard } from "@/components/work/digest-card";
import { SuggestionRow } from "@/components/work/suggestion-row";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatRelativeTime } from "@/lib/utils";

function TabCount({ value, tone, label }: { value: number; tone: "accent" | "danger" | "warning"; label: string }) {
  if (value === 0) return null;
  return (
    <Badge tone={tone} className="ml-1.5 px-2 py-0 text-[11px] font-bold shadow-2xs" aria-label={`${value} ${label}`}>
      {value}
    </Badge>
  );
}

export function InboxView({ project }: { project: string }) {
  const [tab, setTab] = React.useState<"conversations" | "updates" | "issues" | "approvals">(
    "conversations",
  );
  // Every tab carries the count that matters for it - what is open, what is
  // waiting - so the tab bar is a status line, not just navigation.
  const awaiting = useActionItems({ project, status: "needs_approval" }, { refetchInterval: 10_000 });
  const openConversations = useConversations({ project, status: "open" });
  const openIssues = useIssues({ project, status: "open" });
  const openSuggestions = useSuggestions({ project, status: "open" });
  const unreadDigests = useDigests({ project, status: "unread" });
  const counts = {
    conversations: openConversations.data?.length ?? 0,
    updates: unreadDigests.data?.length ?? 0,
    // Suggestions share this tab, so they share its count: the number is what
    // is waiting on a person, whichever shape it arrived in.
    issues: (openIssues.data?.length ?? 0) + (openSuggestions.data?.length ?? 0),
    approvals: awaiting.data?.length ?? 0,
  };
  const [agentId, setAgentId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
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

  return (
    <Page>
      <PageHeader
        title="Inbox"
        description="Everything your agents have handled, and everything they've handed back to you."
      />

      {/* Four tabs and four filters never fit one row, so they get one each. */}
      <PageToolbar stack>
        {/* Four tabs are wider than a phone. The strip scrolls sideways on its
            own rather than making the whole page do it. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
          className="-mx-4 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <TabsList className="w-max">
            <TabsTrigger value="conversations">
              <MessageSquare aria-hidden />
              Conversations
              <TabCount value={counts.conversations} tone="accent" label="open" />
            </TabsTrigger>
            <TabsTrigger value="updates">
              <Newspaper aria-hidden />
              Updates
              <TabCount value={counts.updates} tone="accent" label="unread" />
            </TabsTrigger>
            <TabsTrigger value="issues" className="whitespace-nowrap">
              <Bug aria-hidden />
              Issues &amp; suggestions
              <TabCount value={counts.issues} tone="danger" label="open" />
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <ClipboardCheck aria-hidden />
              Approvals
              <TabCount value={counts.approvals} tone="warning" label="waiting" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          {/* Both of these read transcripts, which the Updates tab has none of. */}
          <div className={tab === "updates" ? "hidden" : "relative w-full sm:w-56"}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden
            />
            <label htmlFor="inbox-search" className="sr-only">
              Search conversations
            </label>
            <Input
              id="inbox-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transcripts…"
              className="pl-9"
            />
          </div>

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

          <div className="w-40">
            <label htmlFor="inbox-status" className="sr-only">
              Filter by status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="inbox-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {tab === "conversations" ? (
                  <>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </>
                ) : tab === "updates" ? (
                  <>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <label
            className={
              tab === "updates" ? "hidden" : "flex items-center gap-2 text-xs text-ink-muted"
            }
          >
            <Switch
              checked={includePreviews}
              onCheckedChange={setIncludePreviews}
              aria-label="Include builder preview chats"
            />
            Include previews
          </label>
        </div>
      </PageToolbar>

      <PageBody>
        {tab === "conversations" ? (
          <ConversationList filters={filters} project={project} />
        ) : tab === "updates" ? (
          <UpdatesList project={project} agentId={agentId} status={status} />
        ) : tab === "issues" ? (
          <IssueList filters={filters} project={project} />
        ) : (
          <ApprovalList project={project} agentId={agentId} />
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
    ) : (
      <EmptyState
        icon={InboxIcon}
        title="No conversations yet"
        description="Once a client opens a published agent's link or widget and sends a message, the transcript lands here."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {data!.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow conversation={conversation} project={project} />
        </li>
      ))}
    </ul>
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
              <Bug aria-hidden />
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
          <MessageSquare className="size-3 text-ink-subtle" aria-hidden />
          {conversation.messageCount} messages
        </span>
      }
      /* When it last moved, at the right edge, so a list of these can be
         scanned down one column instead of hunting for it mid-line. */
      aside={formatRelativeTime(conversation.lastMessageAt)}
    />
  );
}

/**
 * Issues and suggestions in one list, newest first.
 *
 * They are different records - an issue is reported and resolved, a suggestion
 * is proposed and decided - but they are the same thing to the person reading
 * this tab: something that arrived on its own and wants an answer. Merging
 * them here is what the tab was always for.
 */
function IssueList({
  filters,
  project,
}: {
  filters: Record<string, string>;
  project: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useIssues(filters);
  const suggestions = useSuggestions({ project, agentId: filters.agentId ?? "all" });
  const setStatus = useSetIssueStatus();

  const shown = React.useMemo(() => {
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

  // Both lists feed this tab, so neither may fail quietly behind the other.
  if (isPending || suggestions.isPending) return <LoadingRows count={4} />;
  if (error || suggestions.error) {
    return (
      <ErrorState
        message={errorMessage(error ?? suggestions.error)}
        onRetry={() => {
          if (error) void refetch();
          if (suggestions.error) void suggestions.refetch();
        }}
        retrying={isRefetching || suggestions.isRefetching}
      />
    );
  }
  if (data!.length === 0 && shown.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing needs you right now"
        description="When a client reports a bug or an idea, or an agent escalates, cannot finish a task, hits its escalation rule, or has something it thinks you should do next, it shows up here the moment it happens."
      />
    );
  }

  // One list, ordered by when each thing arrived, so a suggestion raised this
  // morning is not buried under last week's resolved issues.
  const rows = [
    ...shown.map((suggestion) => ({
      key: `suggestion-${suggestion.id}`,
      at: suggestion.createdAt,
      node: <SuggestionRow suggestion={suggestion} project={project} />,
    })),
    ...data!.map((issue) => ({
      key: `issue-${issue.id}`,
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
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key}>{row.node}</li>
      ))}
    </ul>
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
  const Icon = { bug: Bug, lightbulb: Lightbulb, handoff: UserRoundCheck, alert: TriangleAlert }[kind.icon];

  return (
    <ListRow
      muted={resolved}
      leading={
        <RowIcon>
          <Icon />
        </RowIcon>
      }
      title={issue.summary}
      badges={
        <>
          <Badge tone={kind.tone}>
            <Icon aria-hidden />
            {kind.label}
          </Badge>
          {/* An escalation is high-severity by construction; the badge would
              just repeat what "Escalated" already says. */}
          {issue.type === "escalation" ? null : <SeverityBadge severity={issue.severity} />}
          {resolved ? <StatusBadge status="resolved" /> : null}
        </>
      }
      body={
        issue.details ? <p className="line-clamp-3 whitespace-pre-wrap text-ink-muted">{issue.details}</p> : null
      }
      meta={
        <>
          {issue.agent ? <span>{issue.agent.name}</span> : null}
          <span aria-hidden>·</span>
          <span>{issue.source === "agent" ? "raised by the agent" : "raised by a client"}</span>
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(issue.createdAt)}</span>
          <span aria-hidden>·</span>
          {issue.conversationId ? (
            <Link href={`/p/${project}/inbox/${issue.conversationId}`} className="text-accent hover:underline">
              View conversation
            </Link>
          ) : issue.actionItemId ? (
            <Link href={`/p/${project}/work?item=${issue.actionItemId}`} className="text-accent hover:underline">
              View the run
            </Link>
          ) : null}
        </>
      }
      trailing={
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
      }
    />
  );
}

/**
 * The Updates tab: what each agent has reported about itself, newest first.
 * An owner who never opens a transcript reads this and knows where they are.
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
    // The tab's status filter means read/unread here; anything else is "all".
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
    ) : (
      <EmptyState
        icon={Newspaper}
        title="No updates yet"
        description="Each agent writes you a short update on its own cadence - what it got done, what is pending, and anything it thinks you should know. Set the cadence in an agent's scope of work, or press Send one now there to see one immediately."
      />
    );
  }

  return (
    <div className="space-y-3">
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
        icon={ClipboardCheck}
        title="Nothing waiting for approval"
        description="When an agent in draft-only mode is ready to publish a post or send an email, it lands here with the full text for you to approve, edit, or reject."
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
