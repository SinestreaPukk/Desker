"use client";

import * as React from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { MessageText } from "./message-text";
import { ToolTrace } from "./tool-trace";
import type { ChatBubble } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

export function ChatThread({
  messages,
  agentName,
  agentAvatarUrl,
  agentSeed,
  sending,
  className,
  emptyState,
  onRate,
}: {
  messages: ChatBubble[];
  agentName: string;
  agentAvatarUrl?: string | null;
  agentSeed?: string;
  sending: boolean;
  className?: string;
  emptyState?: React.ReactNode;
  /** Present on the client surfaces only; the builder preview does not rate. */
  onRate?: (messageId: string, rating: 1 | -1 | 0) => void;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Only auto-scroll when the reader is already at the bottom, so scrolling up
  // to re-read something is not yanked back by every streamed token.
  const pinnedRef = React.useRef(true);

  const handleScroll = React.useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    pinnedRef.current = distance < 80;
  }, []);

  React.useEffect(() => {
    if (pinnedRef.current) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  if (messages.length === 0 && emptyState) {
    return (
      <div className={cn("flex flex-1 items-center justify-center p-6", className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn("flex-1 overflow-y-auto overscroll-contain", className)}
    >
      {/*
        Live region: assistant replies stream in after the user's action, so a
        screen reader needs them announced. `polite` avoids interrupting.
      */}
      <ol className="space-y-5 p-4 sm:p-5" aria-live="polite" aria-atomic="false">
        {messages.map((message) =>
          message.role === "user" ? (
            <li key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-accent-fg">
                <span className="sr-only">You said: </span>
                <div className="space-y-2">
                  <MessageText content={message.content} />
                </div>
              </div>
            </li>
          ) : (
            <li key={message.id} className="flex gap-2.5">
              <AgentAvatar
                name={agentName}
                src={agentAvatarUrl}
                seed={agentSeed}
                size="sm"
                className="mt-0.5"
              />
              <div className="min-w-0 max-w-[85%] space-y-2">
                <span className="sr-only">
                  {message.authorName ?? agentName} said:{" "}
                </span>
                {message.authorName ? (
                  <p className="text-[0.6875rem] font-medium text-ink-muted">
                    {message.authorName} · a colleague
                  </p>
                ) : null}
                {message.activity?.length ? (
                  <ToolTrace activity={message.activity} />
                ) : null}
                {message.content.trim() ? (
                  <div
                    className={cn(
                      "space-y-2 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5",
                      "text-sm leading-relaxed text-ink",
                      message.streaming && "stream-caret",
                    )}
                  >
                    <MessageText content={message.content} />
                  </div>
                ) : message.streaming && !message.activity?.length ? (
                  <TypingIndicator agentName={agentName} />
                ) : null}

                {onRate && message.persisted && !message.streaming && message.content.trim() ? (
                  <RatingControls
                    rating={message.rating ?? null}
                    onRate={(rating) => onRate(message.serverId ?? message.id, rating)}
                  />
                ) : null}
              </div>
            </li>
          ),
        )}

        {/* Covers the gap between pressing send and the first token arriving. */}
        {sending && messages[messages.length - 1]?.role === "user" ? (
          <li className="flex gap-2.5">
            <AgentAvatar
              name={agentName}
              src={agentAvatarUrl}
              seed={agentSeed}
              size="sm"
              className="mt-0.5"
            />
            <TypingIndicator agentName={agentName} />
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />
    </div>
  );
}

/**
 * Thumbs on a reply. Quiet by default - the buttons sit at low contrast until
 * hovered or chosen - because a row of prominent controls under every answer
 * makes a chat feel like a survey.
 */
function RatingControls({
  rating,
  onRate,
}: {
  rating: 1 | -1 | null;
  onRate: (rating: 1 | -1 | 0) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 pl-1" role="group" aria-label="Was this helpful?">
      <button
        type="button"
        aria-label="Helpful"
        aria-pressed={rating === 1}
        onClick={() => onRate(rating === 1 ? 0 : 1)}
        className={cn(
          "rounded-md p-1 transition-colors hover:bg-surface-2",
          rating === 1 ? "text-positive" : "text-ink-subtle hover:text-ink",
        )}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Not helpful"
        aria-pressed={rating === -1}
        onClick={() => onRate(rating === -1 ? 0 : -1)}
        className={cn(
          "rounded-md p-1 transition-colors hover:bg-surface-2",
          rating === -1 ? "text-danger" : "text-ink-subtle hover:text-ink",
        )}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function TypingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-3">
      <span className="sr-only">{agentName} is typing…</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-ink-subtle"
          style={{ animationDelay: `${index * 140}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}
