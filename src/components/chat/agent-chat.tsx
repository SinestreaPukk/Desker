"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { ChatComposer } from "@/components/chat/chat-composer";
import { TypingIndicator } from "@/components/chat/chat-thread";
import { MessageText } from "@/components/chat/message-text";
import { api, errorMessage } from "@/lib/shared/api-client";
import { EVERYDAY_THREAD, type TeamMessageDto, type TeamThreadDto } from "@/lib/agents/team-dto";
import { cn } from "@/lib/shared/utils";

/** How long the chat waits on a reply before it stops showing the assistant typing. */
const REPLY_TIMEOUT_MS = 90_000;

const STARTERS = ["Plan my week", "What can you do for me?", "Remind me to call mum tomorrow at 6"];
const NEW = "new";

/**
 * Chats as tabs, like a chat app: the everyday chat (the one LINE, Telegram and
 * the other apps share) first, then any you start here. Replies sit on the page,
 * yours is a note, and the box is big; on an empty chat it sits in the middle.
 */
export function AgentChat({ project, agent, live }: { project: string; agent: { id: string; name: string }; live: boolean }) {
  const client = useQueryClient();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [typing, setTyping] = React.useState<{ threadId: string; since: string } | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const threadsKey = ["team-threads", project];

  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: () => api<TeamThreadDto[]>(`/api/team?project=${encodeURIComponent(project)}`),
  });
  // Oldest first, so tabs keep their place while you chat.
  const chats = [...(threads.data ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  const everyday = chats.find((chat) => chat.title === EVERYDAY_THREAD);
  const current = chosen ?? everyday?.id ?? chats[0]?.id ?? NEW;
  const isNew = current === NEW || !chats.some((chat) => chat.id === current);
  const threadId = isNew ? null : current;

  const messages = useQuery({
    queryKey: ["team-messages", threadId],
    queryFn: () => api<TeamMessageDto[]>(`/api/team/${threadId}`),
    enabled: Boolean(threadId),
    // Brisk while the assistant is answering; slow otherwise, to catch messages from the phone and finished tasks.
    refetchInterval: typing?.threadId === threadId ? 2_000 : 10_000,
    refetchIntervalInBackground: typing?.threadId === threadId,
  });
  const list = threadId ? (messages.data ?? []) : [];
  const answering =
    typing !== null && typing.threadId === threadId && !list.some((message) => message.agent && message.createdAt >= typing.since);

  React.useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(null), REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [typing]);

  const send = useMutation({
    mutationFn: (content: string) =>
      api<{ threadId: string; message: TeamMessageDto }>("/api/team", {
        method: "POST",
        body: JSON.stringify({ project, content, ...(isNew ? { newChat: true } : { threadId }) }),
      }),
    onSuccess: ({ threadId: id, message }) => {
      client.setQueryData<TeamMessageDto[]>(["team-messages", id], (old = []) =>
        old.some((item) => item.id === message.id) ? old : [...old, message],
      );
      void client.invalidateQueries({ queryKey: threadsKey });
      setChosen(id);
      setTyping({ threadId: id, since: message.createdAt });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  async function remove(id: string) {
    try {
      await api(`/api/team/${id}`, { method: "DELETE" });
      client.setQueryData<TeamThreadDto[]>(threadsKey, (old) => (old ?? []).filter((chat) => chat.id !== id));
      setChosen(null);
      setConfirming(false);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [list.length, answering, threadId]);

  if (threads.isPending) return <LoadingRows count={4} />;
  if (threads.error) return <ErrorState message={errorMessage(threads.error)} onRetry={() => void threads.refetch()} />;

  const empty = list.length === 0 && !messages.isLoading;
  const composer = (
    <ChatComposer
      key={current}
      onSend={(text) => send.mutate(text)}
      sending={send.isPending}
      disabled={!live}
      placeholder={live ? `Message ${agent.name}` : `${agent.name} is off`}
      autoFocus
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Chats">
        {chats.map((chat) => {
          const active = chat.id === current && !isNew;
          return (
            <span key={chat.id} className={cn("flex shrink-0 items-center rounded-md", active ? "bg-ink/[0.07]" : "hover:bg-ink/[0.04]")}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setChosen(chat.id);
                  setConfirming(false);
                }}
                className={cn("max-w-44 truncate rounded-md px-3 py-1.5 text-sm", active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink")}
              >
                {chat.title === EVERYDAY_THREAD ? "Everyday" : chat.title}
              </button>
              {active && chat.id !== everyday?.id ? (
                confirming ? (
                  <button type="button" onClick={() => void remove(chat.id)} className="mr-1 rounded-md px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-soft">
                    Delete?
                  </button>
                ) : (
                  <button type="button" aria-label="Delete this chat" onClick={() => setConfirming(true)} className="mr-1 rounded-md p-1 text-ink-subtle hover:text-ink">
                    <X className="size-3.5" aria-hidden />
                  </button>
                )
              ) : null}
            </span>
          );
        })}
        {isNew && chats.length > 0 ? (
          <span role="tab" aria-selected className="shrink-0 rounded-md bg-ink/[0.07] px-3 py-1.5 text-sm font-semibold text-ink">
            New chat
          </span>
        ) : null}
        <button
          type="button"
          aria-label="New chat"
          title="New chat"
          disabled={isNew}
          onClick={() => {
            setChosen(NEW);
            setConfirming(false);
          }}
          className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-ink/[0.05] hover:text-ink disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {/* One tinted note behind the whole conversation, so the white message box stands out from it. */}
      <div
        className="flex min-h-0 flex-1 flex-col rounded-panel border border-line p-4 sm:p-5"
        style={{ background: "color-mix(in oklch, var(--note-lemon) 38%, var(--surface))" }}
      >
        {!live ? (
          <p className="mb-3 rounded-md bg-surface px-4 py-2.5 text-sm text-ink shadow-xs">
            {agent.name} is off. Add a few lines about you in Profile, then switch it on.
          </p>
        ) : null}

        {empty ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 pb-16">
            <h2 className="text-center font-hand text-large-title text-ink">How can I help?</h2>
            {composer}
            {live ? (
              <div className="flex flex-wrap justify-center gap-2">
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
            ) : null}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <ol className="space-y-6 pb-4 pt-2" aria-label="Messages" aria-live="polite">
                {list.map((message) => (
                  <Line key={message.id} message={message} />
                ))}
                {answering ? (
                  <li className="flex items-center gap-3">
                    <AgentAvatar name={agent.name} seed={agent.id} size="sm" />
                    <TypingIndicator agentName={agent.name} />
                  </li>
                ) : null}
              </ol>
            </div>
            <div className="pb-4 pt-2">{composer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ message }: { message: TeamMessageDto }) {
  if (!message.agent) {
    return (
      <li className="flex justify-end">
        <div className="max-w-[85%] rounded-panel rounded-br-md px-4 py-2.5 text-base leading-relaxed text-ink shadow-xs" style={{ background: "var(--note-sky)" }}>
          <div className="space-y-2">
            <MessageText content={message.content} />
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="flex gap-3">
      <AgentAvatar name={message.agent.name} src={message.agent.avatarUrl} seed={message.agent.id} size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3 text-base leading-relaxed text-ink">
        <MessageText content={message.content} />
      </div>
    </li>
  );
}
