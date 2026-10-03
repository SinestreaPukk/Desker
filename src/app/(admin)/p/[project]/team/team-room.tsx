"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, MessagesSquare, SquarePen, Trash2, UsersRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { ChatComposer } from "@/components/chat/chat-composer";
import { TypingIndicator } from "@/components/chat/chat-thread";
import { MessageText } from "@/components/chat/message-text";
import { useAgents } from "@/hooks/use-admin-data";
import { api, errorMessage } from "@/lib/shared/api-client";
import type { TeamMessageDto, TeamThreadDto } from "@/lib/agents/team-dto";
import { cn, formatRelativeTime, formatTime } from "@/lib/shared/utils";

/** How long a chat waits on a reply before it stops showing someone typing. */
const REPLY_TIMEOUT_MS = 90_000;

/** Openers for an empty chat: one tap sends them. */
const STARTERS = [
  "Can I afford a 4-day trip next week?",
  "Remind me to renew my passport",
  "What should I focus on this week?",
];

type Waiting = { threadId: string; agents: { id: string; name: string }[]; since: string };

/**
 * The team room, laid out like any chat app: the chat history down the side,
 * the open chat beside it with its messages scrolling above a pinned
 * composer. The owner writes once; the agents whose work it is answer, and
 * work they are given becomes a task in Work, reported back in the same chat.
 */
export function TeamRoom({ project }: { project: string }) {
  const client = useQueryClient();
  const agents = useAgents(project);
  const team = (agents.data ?? []).filter((agent) => agent.status === "published");

  // The open chat lives in the address (?chat=), so a refresh or a shared link keeps it.
  // Null is a new, unsent chat; undefined means nothing chosen yet.
  const [chosen, setChosen] = React.useState<string | null | undefined>(() =>
    typeof window === "undefined" ? undefined : (new URLSearchParams(window.location.search).get("chat") ?? undefined),
  );
  const [waiting, setWaiting] = React.useState<Waiting | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const threadsKey = ["team-threads", project];
  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: () => api<TeamThreadDto[]>(`/api/team?project=${encodeURIComponent(project)}`),
    refetchInterval: 30_000,
  });
  // Nothing chosen yet: the latest chat, or a new one when there is none.
  const threadId = chosen === undefined ? (threads.data?.[0]?.id ?? null) : chosen;
  const thread = threads.data?.find((item) => item.id === threadId) ?? null;

  const open = (id: string | null) => {
    setChosen(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("chat", id);
    else url.searchParams.delete("chat");
    window.history.replaceState(null, "", url);
  };

  const typingHere = waiting && waiting.threadId === threadId ? waiting : null;
  const messages = useQuery({
    queryKey: ["team-messages", threadId],
    queryFn: () => api<TeamMessageDto[]>(`/api/team/${threadId}`),
    enabled: Boolean(threadId),
    // Brisk while someone is typing; slow otherwise, to catch tasks reporting back.
    refetchInterval: typingHere ? 2_000 : 10_000,
    // Replies land even while the tab is in the background, so they are there on return.
    refetchIntervalInBackground: Boolean(typingHere),
  });
  const list = threadId ? (messages.data ?? []) : [];

  // Whoever has replied since the owner spoke stops typing; nobody types forever.
  const pending = typingHere
    ? typingHere.agents.filter(
        (agent) => !list.some((message) => message.agent?.id === agent.id && message.createdAt >= typingHere.since),
      )
    : [];
  React.useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaiting(null), REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const send = useMutation({
    mutationFn: (content: string) =>
      api<{ threadId: string; message: TeamMessageDto; responders: { id: string; name: string }[] }>("/api/team", {
        method: "POST",
        body: JSON.stringify({ project, threadId: threadId ?? undefined, content }),
      }),
    onSuccess: ({ threadId: id, message, responders }) => {
      // A poll may have brought the message in already.
      client.setQueryData<TeamMessageDto[]>(["team-messages", id], (old = []) =>
        old.some((item) => item.id === message.id) ? old : [...old, message],
      );
      if (id !== threadId) open(id);
      void client.invalidateQueries({ queryKey: threadsKey });
      setWaiting(responders.length > 0 ? { threadId: id, agents: responders, since: message.createdAt } : null);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  async function deleteChat() {
    if (!threadId) return;
    try {
      await api(`/api/team/${threadId}`, { method: "DELETE" });
      client.setQueryData<TeamThreadDto[]>(threadsKey, (old) => (old ?? []).filter((item) => item.id !== threadId));
      open(null);
      toast.success("Chat deleted", { description: "Tasks it started are still in Work." });
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  // Keep the newest line in view, inside the chat's own scroll area.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [threadId, list.length, pending.length]);

  if (agents.isLoading || threads.isLoading) {
    return (
      <div className="p-6">
        <LoadingRows count={4} />
      </div>
    );
  }
  if (threads.error) {
    return (
      <div className="p-6">
        <ErrorState message={errorMessage(threads.error)} onRetry={() => void threads.refetch()} />
      </div>
    );
  }
  if (team.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={UsersRound}
          title="Nobody in the room yet"
          description="Switch an assistant on from the Roster and you can chat with it here."
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.75rem)] lg:h-dvh">
      {/* The chat history. */}
      <aside aria-label="Chat history" className="hidden w-72 shrink-0 flex-col border-r border-line/70 md:flex">
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-5">
          <h1 className="text-lg font-semibold text-ink">Chats</h1>
          <Button size="sm" variant="secondary" onClick={() => open(null)}>
            <SquarePen aria-hidden />
            New chat
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {(threads.data ?? []).length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-muted">Your chats show up here.</p>
          ) : (
            <ul className="space-y-0.5">
              {(threads.data ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item.id)}
                    aria-current={item.id === threadId ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors",
                      item.id === threadId ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                    <span className="block text-xs text-ink-muted">{formatRelativeTime(item.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {/* The open chat. */}
      <section aria-label={thread?.title ?? "New chat"} className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            {/* On a phone the history is a picker in the chat's own header. */}
            <div className="md:hidden">
              <label htmlFor="team-chat-picker" className="sr-only">
                Chat history
              </label>
              <Select value={threadId ?? "new"} onValueChange={(value) => open(value === "new" ? null : value)}>
                <SelectTrigger id="team-chat-picker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New chat</SelectItem>
                  {(threads.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <h2 className="hidden truncate text-base font-semibold text-ink md:block">{thread?.title ?? "New chat"}</h2>
          </div>
          <div className="flex shrink-0 -space-x-2" aria-label={`In the room: ${team.map((agent) => agent.name).join(", ")}`}>
            {team.slice(0, 6).map((agent) => (
              <AgentAvatar key={agent.id} name={agent.name} src={agent.avatarUrl} seed={agent.id} size="sm" className="ring-2 ring-paper" />
            ))}
          </div>
          {threadId ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete this chat"
              title="Delete this chat"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl py-6">
            {!threadId ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
                  <MessagesSquare className="size-5" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold text-ink">
                  Talk to your assistants
                </h2>
                <p className="mt-1 max-w-md text-sm text-ink-muted">
                  Ask anything or hand over a job. The right assistant answers. Use @Name to ask one, or @everyone for all of them.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      disabled={send.isPending}
                      onClick={() => send.mutate(starter)}
                      className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-accent-line hover:bg-accent-soft/40"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.isLoading ? (
              <LoadingRows count={3} />
            ) : messages.error ? (
              <ErrorState message={errorMessage(messages.error)} onRetry={() => void messages.refetch()} />
            ) : (
              <ol className="space-y-5" aria-label="Messages" aria-live="polite">
                {list.map((message, index) => (
                  <React.Fragment key={message.id}>
                    {index === 0 || dayOf(list[index - 1]!.createdAt) !== dayOf(message.createdAt) ? (
                      <li aria-hidden className="flex items-center gap-3 text-xs text-ink-muted">
                        <span className="h-px flex-1 bg-line" />
                        {dayLabel(message.createdAt)}
                        <span className="h-px flex-1 bg-line" />
                      </li>
                    ) : null}
                    <TeamLine message={message} project={project} />
                  </React.Fragment>
                ))}
              </ol>
            )}

            {pending.length > 0 ? (
              <div className="mt-5 flex items-center gap-2.5">
                <AgentAvatar name={pending[0]!.name} seed={pending[0]!.id} size="sm" />
                <TypingIndicator agentName={names(pending)} />
                <span aria-hidden className="text-xs text-ink-muted">
                  {names(pending)} {pending.length === 1 ? "is" : "are"} typing…
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-4 pb-4 sm:px-6">
          <ChatComposer
            key={threadId ?? "new"}
            onSend={(text) => send.mutate(text)}
            sending={send.isPending}
            placeholder="Message your assistants… (@Name to ask one, @everyone for all)"
            autoFocus
            className="mx-auto max-w-3xl border-t-0 bg-transparent p-0"
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this chat?"
        description="The messages are removed for good. Tasks it started stay in Work."
        confirmLabel="Delete chat"
        onConfirm={deleteChat}
      />
    </div>
  );
}

const dayOf = (iso: string) => new Date(iso).toDateString();

/** "Bright", "Bright and Tim", "Bright, John and Tim". */
function names(agents: { name: string }[]): string {
  const all = agents.map((agent) => agent.name);
  return all.length <= 1 ? (all[0] ?? "") : `${all.slice(0, -1).join(", ")} and ${all.at(-1)}`;
}

/** "Today", "Yesterday", or the date: the separator between days in a chat. */
function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  if (day.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function TeamLine({ message, project }: { message: TeamMessageDto; project: string }) {
  const task = message.actionItemId ? (
    <Link
      href={`/p/${project}/work/${message.actionItemId}`}
      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
    >
      See the task in Work
      <ArrowUpRight className="size-3" aria-hidden />
    </Link>
  ) : null;

  if (!message.agent) {
    return (
      <li className="flex flex-col items-end">
        <p className="mb-1 text-xs text-ink-muted">
          {message.authorName} · {formatTime(message.createdAt)}
        </p>
        <div className="max-w-[85%] rounded-panel rounded-br-sm bg-accent px-4 py-2.5 text-sm leading-relaxed text-accent-fg">
          <div className="space-y-2">
            <MessageText content={message.content} />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2.5">
      <AgentAvatar
        name={message.agent.name}
        src={message.agent.avatarUrl}
        seed={message.agent.id}
        size="sm"
        className="mt-5 ring-1 ring-line/50"
      />
      <div className="min-w-0 max-w-[85%]">
        <p className="mb-1 text-xs text-ink-muted">
          <span className="font-medium text-ink">{message.agent.name}</span>, {message.agent.jobTitle} ·{" "}
          {formatTime(message.createdAt)}
        </p>
        <div className="rounded-panel rounded-tl-sm border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
          <div className="space-y-2">
            <MessageText content={message.content} />
          </div>
        </div>
        {task}
      </div>
    </li>
  );
}
