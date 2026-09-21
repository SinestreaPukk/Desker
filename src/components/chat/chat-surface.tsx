"use client";

import * as React from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "./chat-composer";
import { ChatThread } from "./chat-thread";
import { useChatStream, type ChatBubble } from "@/hooks/use-chat-stream";
import { useClientLiveFeed } from "@/hooks/use-client-live-feed";
import { cn } from "@/lib/utils";

export interface ChatSurfaceAgent {
  id: string;
  name: string;
  jobTitle: string;
  department?: string | null;
  avatarUrl?: string | null;
  welcomeMessage?: string | null;
}

/**
 * The chat experience itself, shared verbatim by the public page, the embedded
 * widget and the builder's preview pane. One implementation means the preview
 * cannot drift away from what a client actually sees.
 */
export function ChatSurface({
  agent,
  endpoint,
  payload,
  initialMessages,
  header,
  disabled,
  className,
  composerPlaceholder,
  autoFocus,
  onSettled,
  controlsRef,
  liveFeedUrl,
  onRate,
  initiallyHandedToHuman = false,
}: {
  agent: ChatSurfaceAgent;
  endpoint: string;
  payload: Record<string, unknown>;
  initialMessages?: ChatBubble[];
  header?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  composerPlaceholder?: string;
  autoFocus?: boolean;
  onSettled?: () => void;
  /** Lets a parent reset the thread (e.g. the builder's "Restart" button). */
  controlsRef?: React.RefObject<{ reset: (next?: ChatBubble[]) => void } | null>;
  /**
   * SSE endpoint carrying turns this client did not ask for - a colleague
   * replying from the inbox. Omitted in the builder preview, which has no
   * client on the other end.
   */
  liveFeedUrl?: string;
  /**
   * Persists a rating. Omitted in the builder preview - an admin rating their
   * own agent's test answers would pollute the insights.
   */
  onRate?: (messageId: string, rating: 1 | -1 | 0) => Promise<void>;
  /** Whether a colleague already holds the conversation on first load. */
  initiallyHandedToHuman?: boolean;
}) {
  const greeting = React.useMemo<ChatBubble[]>(
    () =>
      agent.welcomeMessage?.trim()
        ? [
            {
              id: "greeting",
              role: "assistant" as const,
              content: agent.welcomeMessage.trim(),
            },
          ]
        : [],
    [agent.welcomeMessage],
  );

  const [handedToHuman, setHandedToHuman] = React.useState(initiallyHandedToHuman);

  const chat = useChatStream({
    endpoint,
    payload,
    initialMessages: initialMessages ?? greeting,
    onSettled,
  });

  // A colleague's reply arrives here rather than as a response to anything the
  // client sent, which is what makes an escalation a conversation instead of a
  // dead end.
  useClientLiveFeed(liveFeedUrl, {
    onMessage: (message) => {
      chat.receive({
        id: message.messageId,
        serverId: message.messageId,
        persisted: true,
        role: "assistant",
        content: message.content,
        authorName: message.authorName,
      });
    },
    onMode: (mode) => setHandedToHuman(mode === "human"),
  });

  React.useImperativeHandle(controlsRef, () => ({ reset: chat.reset }), [chat.reset]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-paper", className)}>
      {header}

      <ChatThread
        messages={chat.messages}
        agentName={agent.name}
        agentAvatarUrl={agent.avatarUrl}
        agentSeed={agent.id}
        sending={chat.sending}
        onRate={
          onRate
            ? (messageId, rating) => {
                // Optimistic: the thumbs respond immediately, and a failed
                // save simply reverts on the next reload.
                chat.setRating(messageId, rating === 0 ? null : rating);
                void onRate(messageId, rating);
              }
            : undefined
        }
        emptyState={
          <div className="max-w-xs text-center">
            <AgentAvatar
              name={agent.name}
              src={agent.avatarUrl}
              seed={agent.id}
              size="xl"
              className="mx-auto"
            />
            {/* Not a heading: the chat header already carries the agent's
                name as the page h1, and repeating it as an h2 gives the
                document two headings with identical text. */}
            <p className="mt-4 text-base font-semibold text-ink">{agent.name}</p>
            <p className="text-sm text-ink-muted">
              {agent.jobTitle}
              {agent.department ? ` · ${agent.department}` : ""}
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm leading-relaxed text-ink-muted">
              <MessageSquareText className="size-3.5 shrink-0" aria-hidden />
              Ask a question to get started.
            </p>
          </div>
        }
      />

      {chat.error ? (
        <div
          role="alert"
          className="mx-3 mb-2 flex items-start justify-between gap-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2.5"
        >
          <p className="text-sm leading-relaxed text-danger">{chat.error}</p>
          {chat.retryable ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={chat.retry}
              className="shrink-0"
            >
              <RefreshCw aria-hidden />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {handedToHuman ? (
        <p
          className="mx-3 mb-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-soft-fg"
          role="status"
        >
          A colleague has joined and is answering you directly.
        </p>
      ) : null}

      <ChatComposer
        onSend={chat.send}
        onStop={chat.stop}
        sending={chat.sending}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={composerPlaceholder}
      />
    </div>
  );
}
