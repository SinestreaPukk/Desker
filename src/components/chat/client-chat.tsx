"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, MessageSquareOff, RotateCcw } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { ChatSurface } from "./chat-surface";
import {
  getClientSessionId,
  resetClientSession,
  serverSessionSnapshot,
  subscribeClientSession,
} from "@/lib/client-session";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import type { ChatBubble } from "@/hooks/use-chat-stream";
import type { MessageDto, PublicAgentDto } from "@/lib/serialize";
import { cn } from "@/lib/utils";

interface Loaded {
  agent: PublicAgentDto;
  messages: MessageDto[];
  /** A colleague currently holds this conversation. */
  handledByHuman?: boolean;
}

/** Reads the browser-owned session id without a hydration mismatch. */
function useClientSession(agentId: string): string | null {
  return React.useSyncExternalStore(
    subscribeClientSession,
    () => getClientSessionId(agentId),
    serverSessionSnapshot,
  );
}

function fetchChat(
  agentId: string,
  sessionId: string,
  passcode?: string,
): Promise<Loaded> {
  return api<Loaded>(
    `/api/chat/${agentId}?sessionId=${encodeURIComponent(sessionId)}`,
    passcode ? { headers: { "x-desker-passcode": passcode } } : undefined,
  );
}

/**
 * The full client-facing chat, used by both the standalone page and the
 * embedded widget. Handles no-account session continuity, the optional
 * passcode gate, and history restore.
 */
export function ClientChat({
  agentId,
  variant,
  onClose,
}: {
  agentId: string;
  variant: "page" | "widget";
  onClose?: () => void;
}) {
  const sessionId = useClientSession(agentId);
  // Held in state, not a query key, so an accepted passcode survives a refetch.
  const [passcode, setPasscode] = React.useState("");
  const [unlocked, setUnlocked] = React.useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["client-chat", agentId, sessionId, unlocked],
    queryFn: () =>
      fetchChat(agentId, sessionId!, unlocked ? passcode : undefined),
    enabled: Boolean(sessionId),
    // History is restored once per mount; the live thread is held by the
    // streaming hook from there on.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (!sessionId || isPending) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-5" aria-busy>
        <span className="sr-only">Loading chat…</span>
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-5">
        <EmptyState
          icon={MessageSquareOff}
          title="This chat isn't available"
          description={errorMessage(error)}
          className="border-none bg-transparent"
        />
      </div>
    );
  }

  const { agent, messages } = data!;

  if (agent.requiresPasscode && !unlocked) {
    return (
      <PasscodeGate
        agent={agent}
        agentId={agentId}
        sessionId={sessionId}
        value={passcode}
        onChange={setPasscode}
        onVerified={() => setUnlocked(true)}
      />
    );
  }

  const liveFeedUrl = `/api/chat/${agentId}/live?sessionId=${encodeURIComponent(sessionId)}`;

  const initial: ChatBubble[] = [
    ...(agent.welcomeMessage?.trim() && messages.length === 0
      ? [
          {
            id: "greeting",
            role: "assistant" as const,
            content: agent.welcomeMessage.trim(),
          },
        ]
      : []),
    ...messages.map((message) => ({
      id: message.id,
      // A colleague's turn reaches the client in the same place an agent's
      // does; only the byline differs.
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      content: message.content,
      authorName: message.role === "human" ? (message.authorName ?? null) : null,
      serverId: message.id,
      persisted: message.role !== "user",
      rating: (message.rating === 1 ? 1 : message.rating === -1 ? -1 : null) as 1 | -1 | null,
    })),
  ];

  const rate = async (messageId: string, rating: 1 | -1 | 0) => {
    try {
      await api("/api/chat/feedback", {
        method: "POST",
        body: JSON.stringify({ agentId, sessionId, messageId, rating }),
      });
    } catch {
      // Feedback is best-effort; a failed save is not worth an error banner
      // in the middle of someone's conversation.
    }
  };

  return (
    <ChatSurface
      key={sessionId}
      agent={agent}
      endpoint="/api/chat"
      payload={{ agentId, sessionId, ...(passcode ? { passcode } : {}) }}
      initialMessages={initial}
      liveFeedUrl={liveFeedUrl}
      onRate={rate}
      initiallyHandedToHuman={Boolean(data!.handledByHuman)}
      autoFocus={variant === "widget"}
      header={
        <header
          className={cn(
            "flex items-center gap-3 border-b border-line bg-surface px-4 py-3",
            variant === "widget" && "rounded-t-panel",
          )}
        >
          <AgentAvatar name={agent.name} src={agent.avatarUrl} seed={agent.id} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.875rem] font-semibold text-ink">
              {agent.name}
            </h1>
            <p className="truncate text-xs text-ink-muted">
              {agent.jobTitle}
              {agent.department ? ` · ${agent.department}` : ""}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Start a new conversation"
            title="Start a new conversation"
            onClick={() => resetClientSession(agentId)}
          >
            <RotateCcw aria-hidden />
          </Button>

          {onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close chat"
              onClick={onClose}
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </Button>
          ) : null}
        </header>
      }
    />
  );
}

function PasscodeGate({
  agent,
  agentId,
  sessionId,
  value,
  onChange,
  onVerified,
}: {
  agent: PublicAgentDto;
  agentId: string;
  sessionId: string;
  value: string;
  onChange: (next: string) => void;
  onVerified: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // The history endpoint is the passcode check: it releases a transcript only
    // to a request carrying the right passcode, and 401s otherwise. No model
    // call, nothing written, no sentinel message in the conversation.
    try {
      await fetchChat(agentId, sessionId, value);
      onVerified();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? "That passcode isn't right."
          : errorMessage(caught),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 text-center">
        <AgentAvatar
          name={agent.name}
          src={agent.avatarUrl}
          seed={agent.id}
          size="xl"
          className="mx-auto"
        />
        <div>
          <h1 className="text-base font-semibold text-ink">{agent.name}</h1>
          <p className="text-[0.8125rem] text-ink-muted">{agent.jobTitle}</p>
        </div>

        <div className="text-left">
          <Field
            label="Passcode"
            htmlFor="passcode-gate"
            hint="This chat is passcode protected."
            error={error ?? undefined}
          >
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <Input
                type="password"
                autoComplete="off"
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="pl-9"
              />
            </div>
          </Field>
        </div>

        <Button type="submit" className="w-full" loading={pending} disabled={!value}>
          Enter chat
        </Button>
      </form>
    </div>
  );
}
