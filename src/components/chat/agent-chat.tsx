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

/** How long the chat waits on a reply before it stops showing the assistant typing. */
const REPLY_TIMEOUT_MS = 90_000;

const STARTERS = ["Plan my week", "What can you do for me?", "Remind me to call mum tomorrow at 6"];

/**
 * The conversation with the assistant: one thread, the same one LINE, Telegram
 * and the other apps write to, so a chat started on the phone continues here.
 * Laid out like any chat app: replies on the page, yours as a note, the box pinned below.
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

  const empty = list.length === 0 && !messages.isLoading;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {!live ? (
          <p className="mb-4 rounded-md px-4 py-3 text-base text-ink" style={{ background: "var(--note-lemon)" }}>
            {agent.name} is off. Add a few lines about you in Profile, then switch it on.
          </p>
        ) : null}

        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 pb-10 text-center">
            <h2 className="font-hand text-large-title text-ink">How can I help?</h2>
            {live ? (
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={send.isPending}
                    onClick={() => send.mutate(starter)}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-base text-ink transition-colors hover:border-accent-line hover:bg-accent-soft/40"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ol className="space-y-7 pb-4 pt-2" aria-label="Messages" aria-live="polite">
            {list.map((message) => (
              <Line key={message.id} message={message} />
            ))}
            {typing ? (
              <li className="flex items-center gap-3">
                <AgentAvatar name={agent.name} seed={agent.id} size="sm" />
                <TypingIndicator agentName={agent.name} />
              </li>
            ) : null}
          </ol>
        )}
      </div>

      <div className="pb-4 pt-2">
        <ChatComposer
          onSend={(text) => send.mutate(text)}
          sending={send.isPending}
          disabled={!live}
          placeholder={live ? `Message ${agent.name}` : `${agent.name} is off`}
          autoFocus
        />
      </div>
    </div>
  );
}

function Line({ message }: { message: TeamMessageDto }) {
  if (!message.agent) {
    return (
      <li className="flex justify-end">
        <div
          className="max-w-[85%] rounded-panel rounded-br-md px-5 py-3 text-lg leading-relaxed text-ink shadow-xs"
          style={{ background: "var(--note-sky)" }}
        >
          <div className="space-y-2">
            <MessageText content={message.content} />
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="flex gap-3">
      <AgentAvatar name={message.agent.name} src={message.agent.avatarUrl} seed={message.agent.id} size="sm" className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3 text-lg leading-relaxed text-ink">
        <MessageText content={message.content} />
      </div>
    </li>
  );
}
