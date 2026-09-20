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
  Search,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { ApprovalCard } from "@/components/work/approval-card";
import { useActionItems } from "@/hooks/use-work-data";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
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

export function InboxView({ project }: { project: string }) {
  const [tab, setTab] = React.useState<"conversations" | "issues" | "approvals">("conversations");
  const awaiting = useActionItems({ project, status: "needs_approval" }, { refetchInterval: 10_000 });
  const awaitingCount = awaiting.data?.length ?? 0;
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

      <PageToolbar>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="conversations">
              <MessageSquare aria-hidden />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="issues">
              <Bug aria-hidden />
              Issues &amp; suggestions
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <ClipboardCheck aria-hidden />
              Approvals
              {awaitingCount > 0 ? (
                <Badge tone="warning" className="ml-1.5">
                  {awaitingCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
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
                ) : (
                  <>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-muted">
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
    <Panel className="relative transition-shadow hover:shadow-md focus-within:shadow-md">
      <div className="flex items-start gap-3 p-4">
        <AgentAvatar
          name={conversation.agent.name}
          src={conversation.agent.avatarUrl}
          seed={conversation.agent.id}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[0.8125rem] font-semibold text-ink">
              <Link
                href={`/p/${project}/inbox/${conversation.id}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {conversation.agent.name}
              </Link>
            </h2>
            <StatusBadge status={conversation.status} />
            {conversation.mode === "human" ? (
              <Badge tone="warning">
                <UserRound aria-hidden />
                {conversation.takenOverBy
                  ? `${conversation.takenOverBy} replying`
                  : "Human replying"}
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
          </div>

          {conversation.summary ? (
            <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink">
              {conversation.summary}
            </p>
          ) : (
            <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-muted">
              {conversation.preview || "No client message yet."}
            </p>
          )}

          <p className="mt-2 meta">
            {conversation.messageCount} messages ·{" "}
            {formatRelativeTime(conversation.lastMessageAt)}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function IssueList({
  filters,
  project,
}: {
  filters: Record<string, string>;
  project: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useIssues(filters);
  const setStatus = useSetIssueStatus();

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
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing needs you right now"
        description="When a client reports a bug or an idea, or an agent escalates, cannot finish a task, or hits its escalation rule, it shows up here the moment it happens."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {data!.map((issue) => (
        <li key={issue.id}>
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
    <Panel className={resolved ? "opacity-70" : undefined}>
      <div className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2"
        >
          <Icon className="size-4 text-ink-muted" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={kind.tone}>
              <Icon aria-hidden />
              {kind.label}
            </Badge>
            {/* An escalation is high-severity by construction; the badge would
                just repeat what "Escalated" already says. */}
            {issue.type === "escalation" ? null : (
              <SeverityBadge severity={issue.severity} />
            )}
            {resolved ? <StatusBadge status="resolved" /> : null}
          </div>

          <h2 className="mt-1.5 text-[0.8125rem] font-semibold text-ink">
            {issue.summary}
          </h2>

          {issue.details ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-ink-muted">
              {issue.details}
            </p>
          ) : null}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 meta">
            {issue.agent ? <span>{issue.agent.name}</span> : null}
            <span aria-hidden>·</span>
            <span>{issue.source === "agent" ? "raised by the agent" : "raised by a client"}</span>
            <span aria-hidden>·</span>
            <span>{formatRelativeTime(issue.createdAt)}</span>
            <span aria-hidden>·</span>
            {issue.conversationId ? (
              <Link
                href={`/p/${project}/inbox/${issue.conversationId}`}
                className="text-accent hover:underline"
              >
                View conversation
              </Link>
            ) : issue.actionItemId ? (
              <Link
                href={`/p/${project}/work?item=${issue.actionItemId}`}
                className="text-accent hover:underline"
              >
                View the run
              </Link>
            ) : null}
          </p>
        </div>

        <Button
          variant={resolved ? "ghost" : "secondary"}
          size="sm"
          loading={pending}
          onClick={onToggle}
          className="shrink-0"
        >
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
      </div>
    </Panel>
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
