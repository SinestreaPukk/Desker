"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/shared/utils";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { ApprovalCard } from "@/components/chat/approval-card";
import { OpenLoopsThreadCard } from "@/components/commitments/open-loops-card";
import { ChatComposer } from "@/components/chat/chat-composer";
import { TypingIndicator } from "@/components/chat/chat-thread";
import { MessageText } from "@/components/chat/message-text";
import { api, errorMessage } from "@/lib/shared/api-client";
import { EVERYDAY_THREAD, NEW_CHAT, chatTitle, type TeamMessageDto, type TeamThreadDto } from "@/lib/agents/team-dto";
import { ATTACHMENT_ACCEPT } from "@/lib/life/attachments-shared";

/** How long the chat waits on a reply before it stops showing the assistant typing. */
const REPLY_TIMEOUT_MS = 90_000;

const STARTERS = ["Plan my week", "What can you do for me?", "Remind me to call mum tomorrow at 6"];
const NEW = NEW_CHAT;

/**
 * Chats as tabs, like a chat app: the everyday chat (the one LINE, Telegram and
 * the other apps share) first, then any you start here. Replies sit on the page,
 * yours is a note, and the box is big; on an empty chat it sits in the middle.
 */
export function AgentChat({ project, agent, live, onNeedAbout }: { project: string; agent: { id: string; name: string }; live: boolean; onNeedAbout: () => void }) {
  const client = useQueryClient();
  // Which chat is open lives in the address (?c=), so the sidebar's history and this page agree.
  const router = useRouter();
  const pathname = usePathname();
  const chosen = useSearchParams().get("c");
  const setChosen = React.useCallback(
    (id: string | null) => router.replace(id ? `${pathname}?c=${id}` : pathname, { scroll: false }),
    [router, pathname],
  );
  const [typing, setTyping] = React.useState<{ threadId: string; since: string } | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [dragging, setDragging] = React.useState(false);
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
      setSuggestions([]);
      client.setQueryData<TeamMessageDto[]>(["team-messages", id], (old = []) =>
        old.some((item) => item.id === message.id) ? old : [...old, message],
      );
      void client.invalidateQueries({ queryKey: threadsKey });
      setChosen(id);
      setTyping({ threadId: id, since: message.createdAt });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      form.append("project", project);
      for (const file of files) form.append("file", file);
      if (isNew) form.append("newChat", "true");
      else if (threadId) form.append("threadId", threadId);
      return api<{ threadId: string; nextSteps: string[] }>("/api/team/attachments", { method: "POST", body: form });
    },
    onSuccess: ({ threadId: id, nextSteps }) => {
      void client.invalidateQueries({ queryKey: threadsKey });
      void client.invalidateQueries({ queryKey: ["team-messages", id] });
      setChosen(id);
      setSuggestions(nextSteps);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });
  const attach = (files: File[]) => {
    if (live && !upload.isPending) upload.mutate(files);
  };

  async function remove(id: string) {
    try {
      await api(`/api/team/${id}`, { method: "DELETE" });
      client.setQueryData<TeamThreadDto[]>(threadsKey, (old) => (old ?? []).filter((chat) => chat.id !== id));
      setChosen(null);
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
      onAttach={attach}
      accept={ATTACHMENT_ACCEPT}
      attaching={upload.isPending}
    />
  );
  const chips = suggestions.length > 0 && !send.isPending ? (
    <div className="mb-2 flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => send.mutate(suggestion)}
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-accent-line hover:bg-accent-soft/40 pointer-coarse:min-h-11"
        >
          {suggestion}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* On a computer the sidebar lists the chats; this is the phone's way to switch. */}
      <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-[70%] pointer-coarse:min-h-11" aria-label="Choose a chat">
              <span className="truncate">{isNew ? "New chat" : chatTitle(chats.find((chat) => chat.id === current)?.title ?? "")}</span>
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {chats.map((chat) => (
              <DropdownMenuItem key={chat.id} onSelect={() => setChosen(chat.id)} className={chat.id === current && !isNew ? "font-semibold" : undefined}>
                <span className="truncate">{chatTitle(chat.title)}</span>
              </DropdownMenuItem>
            ))}
            {!isNew && current !== everyday?.id ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void remove(current)} className="text-danger">
                  <Trash2 aria-hidden />
                  Delete this chat
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {isNew ? null : (
          <Button variant="secondary" size="sm" onClick={() => setChosen(NEW)}>
            <Plus aria-hidden />
            New chat
          </Button>
        )}
      </div>

      {!live ? (
        <p className="mb-3 rounded-md px-4 py-2.5 text-sm text-ink" style={{ background: "var(--note-lemon)" }}>
          {agent.name} is off.{" "}
          <button type="button" onClick={onNeedAbout} className="font-semibold underline underline-offset-2">
            Add a few lines about you
          </button>
          , then switch it on.
        </p>
      ) : null}
      {/* One white panel around the whole conversation. */}
      <div
        className={cn("flex min-h-0 flex-1 flex-col rounded-panel border bg-surface p-4 shadow-xs transition-colors sm:p-5", dragging ? "border-accent bg-accent-soft/30" : "border-line")}
        onDragOver={(event) => {
          if (!live || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          attach(Array.from(event.dataTransfer.files));
        }}
      >

        {empty ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 pb-16">
            <h2 className="text-center font-hand text-large-title text-ink">How can I help?</h2>
            <div>
              {chips}
              {composer}
            </div>
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
                  <Line key={message.id} message={message} project={project} />
                ))}
                {answering || upload.isPending ? (
                  <li className="flex items-center gap-3">
                    <AgentAvatar name={agent.name} seed={agent.id} size="sm" />
                    <TypingIndicator agentName={agent.name} />
                  </li>
                ) : null}
              </ol>
            </div>
            <div className="pb-4 pt-2">
              {chips}
              {composer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ message, project }: { message: TeamMessageDto; project?: string }) {
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
  const isOpenLoops = message.content.includes("<!-- open_loops -->") || message.content.includes("[open_loops]");
  return (
    <li className="flex gap-3">
      <AgentAvatar name={message.agent.name} src={message.agent.avatarUrl} seed={message.agent.id} size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 max-w-[70ch] flex-1 space-y-3 text-base leading-relaxed text-ink">
        <MessageText content={message.content} />
        {isOpenLoops && project ? (
          <div className="mt-2">
            <OpenLoopsThreadCard project={project} />
          </div>
        ) : null}
        {message.actionItemId ? <ApprovalCard actionItemId={message.actionItemId} /> : null}
      </div>
    </li>
  );
}
