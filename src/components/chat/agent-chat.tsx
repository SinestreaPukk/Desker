"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { ChatComposer } from "@/components/chat/chat-composer";
import { TypingIndicator } from "@/components/chat/chat-thread";
import { MessageText } from "@/components/chat/message-text";
import { api, errorMessage } from "@/lib/shared/api-client";
import { EVERYDAY_THREAD, type TeamMessageDto, type TeamThreadDto } from "@/lib/agents/team-dto";
import { formatTime } from "@/lib/shared/utils";

/** How long the chat waits on a reply before it stops showing the assistant typing. */
const REPLY_TIMEOUT_MS = 90_000;

/**
 * The conversation with the assistant: one thread, the same one LINE, Telegram
 * and the other apps write to, so a chat started on the phone continues here.
 */
export function AgentChat({ project, agent, live }: { project: string; agent: { id: string; name: string }; live: boolean }) {
  const client = useQueryClient();
  const [typingSince, setTypingSince] = React.useState<string | null>(null);
  const threadsKey = ["team-threads", project];

  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: () => api<TeamThreadDto[]>(`/api/team?project=${encodeURIComponent(project)}`),
  });
  const threadId = threads.data?.find((thread) => thread.title === EVERYDAY_THREAD)?.id ?? null;

  const messages = useQuery({
    queryKey: ["team-messages", threadId],
    queryFn: () => api<TeamMessageDto[]>(`/api/team/${threadId}`),
    enabled: Boolean(threadId),
    // Brisk while the assistant is answering; slow otherwise, to catch messages from the phone and finished tasks.
    refetchInterval: typingSince ? 2_000 : 10_000,
    refetchIntervalInBackground: Boolean(typingSince),
  });
  const list = threadId ? (messages.data ?? []) : [];
  const typing = Boolean(typingSince) && !list.some((message) => message.agent && message.createdAt >= typingSince!);

  React.useEffect(() => {
    if (!typingSince) return;
    const timer = setTimeout(() => setTypingSince(null), REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [typingSince]);

  const send = useMutation({
    mutationFn: (content: string) =>
      api<{ threadId: string; message: TeamMessageDto }>("/api/team", {
        method: "POST",
        body: JSON.stringify({ project, threadId: threadId ?? undefined, content }),
      }),
    onSuccess: ({ threadId: id, message }) => {
      client.setQueryData<TeamMessageDto[]>(["team-messages", id], (old = []) =>
        old.some((item) => item.id === message.id) ? old : [...old, message],
      );
      void client.invalidateQueries({ queryKey: threadsKey });
      setTypingSince(message.createdAt);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [list.length, typing]);

  if (threads.isPending) return <LoadingRows count={4} />;
  if (threads.error) return <ErrorState message={errorMessage(threads.error)} onRetry={() => void threads.refetch()} />;

  return (
    <div className="flex h-[calc(100dvh-19rem)] min-h-[26rem] flex-col rounded-lg border border-line bg-surface shadow-xs">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {!live ? (
          <p className="mb-4 rounded-md px-3 py-2 text-sm text-ink" style={{ background: "var(--note-lemon)" }}>
            {agent.name} is off. Add a few lines about you in Profile, then switch it on.
          </p>
        ) : null}
        {list.length === 0 && !messages.isLoading ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <h2 className="font-hand text-xl text-ink">Say hello to {agent.name}</h2>
            <p className="mt-2 max-w-sm text-ink-muted">Ask for anything. Tell it about yourself and it remembers.</p>
          </div>
        ) : (
          <ol className="space-y-5" aria-label="Messages" aria-live="polite">
            {list.map((message) => (
              <Line key={message.id} message={message} />
            ))}
          </ol>
        )}
        {typing ? (
          <div className="mt-5 flex items-center gap-2.5">
            <AgentAvatar name={agent.name} seed={agent.id} size="sm" />
            <TypingIndicator agentName={agent.name} />
          </div>
        ) : null}
      </div>
      <div className="border-t border-line p-3 sm:p-4">
        <ChatComposer
          onSend={(text) => send.mutate(text)}
          sending={send.isPending}
          disabled={!live}
          placeholder={live ? `Message ${agent.name}` : `${agent.name} is off`}
          autoFocus
          className="border-t-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
}

function Line({ message }: { message: TeamMessageDto }) {
  if (!message.agent) {
    return (
      <li className="flex flex-col items-end">
        <p className="mb-1 text-xs text-ink-muted">{formatTime(message.createdAt)}</p>
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
      <AgentAvatar name={message.agent.name} src={message.agent.avatarUrl} seed={message.agent.id} size="sm" className="mt-5 ring-1 ring-line/50" />
      <div className="min-w-0 max-w-[85%]">
        <p className="mb-1 text-xs text-ink-muted">
          <span className="font-medium text-ink">{message.agent.name}</span> · {formatTime(message.createdAt)}
        </p>
        <div className="rounded-panel rounded-tl-sm border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
          <div className="space-y-2">
            <MessageText content={message.content} />
          </div>
        </div>
      </div>
    </li>
  );
}
