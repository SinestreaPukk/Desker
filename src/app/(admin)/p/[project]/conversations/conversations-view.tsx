"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, BotMessageSquare, CheckCircle2, Inbox as InboxIcon, Search, UserRound } from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { ListRow } from "@/components/ui/list-row";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { RemoveButton } from "@/components/work/row-actions";
import { useAgents, useConversations } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import type { ConversationSummaryDto } from "@/lib/serialize";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";

/**
 * Conversations: the history of chats with published agents - through a
 * shared link, the website widget, or the builder preview. It is a record to
 * browse, not a queue: anything in a chat that needs a person (an escalation,
 * a reported problem) is raised in Needs you, which is the only action queue.
 */
export interface ConversationsViewProps {
  project: string;
  initialAgentId?: string;
}

export function ConversationsView({ project, initialAgentId }: ConversationsViewProps) {
  const [agentId, setAgentId] = React.useState(initialAgentId ?? "all");
  const [prevInitialAgentId, setPrevInitialAgentId] = React.useState(initialAgentId);
  if (initialAgentId !== prevInitialAgentId) {
    setPrevInitialAgentId(initialAgentId);
    setAgentId(initialAgentId ?? "all");
  }
  const [view, setView] = React.useState<"active" | "done">("active");
  const [includePreviews, setIncludePreviews] = React.useState(false);
  const [search, setSearch] = React.useState("");
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
      status: view === "active" ? "active" : "resolved",
      q: query,
      includePreviews: includePreviews ? "true" : "",
    }),
    [project, agentId, view, query, includePreviews],
  );

  return (
    <Page>
      <PageHeader
        title="Conversations"
        description="Every chat with your published agents, to read back. Anything in one that needs you is already in Needs you."
      />
      <PageToolbar stack>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <label htmlFor="conversation-search" className="sr-only">
              Search transcripts
            </label>
            <Input
              id="conversation-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transcripts…"
              className="pl-9"
            />
          </div>
          <div className="w-44">
            <label htmlFor="conversation-agent" className="sr-only">
              Filter by agent
            </label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="conversation-agent">
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
          <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
            <TabsList aria-label="Show open or resolved">
              <TabsTrigger value="active" className="px-3 py-1 text-xs">
                Open
              </TabsTrigger>
              <TabsTrigger value="done" className="px-3 py-1 text-xs">
                Resolved
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <Switch checked={includePreviews} onCheckedChange={setIncludePreviews} aria-label="Include builder preview chats" />
            Include previews
          </label>
        </div>
      </PageToolbar>
      <PageBody>
        <ConversationList filters={filters} project={project} />
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
      <EmptyState
        icon={CheckCircle2}
        title="Nothing resolved yet"
        description="Conversations move here once they are resolved."
      />
    ) : (
      <EmptyState
        icon={InboxIcon}
        title="No conversations yet"
        description="Chats that come in through a published agent's shared link or website widget land here, for roles that talk to clients or the public."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {filters.status === "resolved" ? (
        <div className="flex justify-end">
          <RemoveButton
            targets={data!.map((conversation) => ({ kind: "conversation" as const, id: conversation.id }))}
            what={`${data!.length} conversation${data!.length === 1 ? "" : "s"}`}
            label="Clear all"
          />
        </div>
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
          href={`/p/${project}/conversations/${conversation.id}`}
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
          <p className="line-clamp-2 text-ink-muted">{conversation.preview || "No message yet."}</p>
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
