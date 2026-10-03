"use client";

import * as React from "react";
import { BotMessageSquare, RefreshCw } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "./chat-composer";
import { ChatThread } from "./chat-thread";
import { useChatStream, type ChatBubble } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/shared/utils";

interface ChatSurfaceAgent {
  id: string;
  name: string;
  jobTitle: string;
  department?: string | null;
  avatarUrl?: string | null;
  welcomeMessage?: string | null;
}

/**
 * The chat experience itself, used by the builder's preview pane.
 */
export const ChatSurface = React.memo(function ChatSurface({
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

  const chat = useChatStream({
    endpoint,
    payload,
    initialMessages: initialMessages ?? greeting,
    onSettled,
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
              <BotMessageSquare className="size-3.5 shrink-0" aria-hidden />
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
});
