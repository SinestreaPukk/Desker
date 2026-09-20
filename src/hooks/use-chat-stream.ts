"use client";

import * as React from "react";
import { readSseStream } from "@/lib/sse-client";

export interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set when a colleague wrote this turn rather than the agent. */
  authorName?: string | null;
  /** The client's rating of this reply, once it has a server-side id. */
  rating?: 1 | -1 | null;
  /**
   * The saved row's id. Kept apart from `id`, which stays the local key the
   * streaming patches target - a turn may be followed by more tool activity
   * on the same bubble, so the key cannot change underneath it.
   */
  serverId?: string;
  /**
   * Set once the turn is persisted. A streamed reply has only a local id until
   * the transcript is reloaded, so feedback is offered only on turns that came
   * from the server.
   */
  persisted?: boolean;
  /** Tool activity attributed to this assistant turn, newest last. */
  activity?: ToolActivity[];
  streaming?: boolean;
}

export interface ToolActivity {
  id: string;
  name: string;
  state: "running" | "done";
  detail?: string;
}

type RuntimeEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; id: string }
  | {
      type: "tool_end";
      name: string;
      id: string;
      effect?:
        | { kind: "issue"; id: string; type: "issue" | "suggestion"; summary: string }
        | { kind: "escalation"; reason: string }
        | { kind: "search"; query: string; hits: number };
    }
  | { type: "transferred"; toAgentId: string; toAgentName: string }
  | { type: "persisted"; messageId: string }
  | { type: "handled_by_human" }
  | { type: "done" }
  | { type: "error"; message: string; retryable: boolean };

function describeEffect(event: Extract<RuntimeEvent, { type: "tool_end" }>): string {
  switch (event.effect?.kind) {
    case "search":
      return event.effect.hits > 0
        ? `Found ${event.effect.hits} passage${event.effect.hits === 1 ? "" : "s"}`
        : "No matches found";
    case "issue":
      return event.effect.type === "issue" ? "Issue logged" : "Suggestion logged";
    case "escalation":
      return "Passed to a human";
    default:
      return "Done";
  }
}

const TOOL_LABELS: Record<string, string> = {
  search_company_context: "Searching company documents",
  log_issue: "Logging an issue",
  log_suggestion: "Logging a suggestion",
  escalate_to_human: "Escalating to a human",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

export interface UseChatStreamOptions {
  endpoint: string;
  /** Merged into the POST body alongside `message`. */
  payload: Record<string, unknown>;
  initialMessages?: ChatBubble[];
  onSettled?: () => void;
  /** Fired when a router hands the conversation to a colleague. */
  onTransferred?: (agentId: string, agentName: string) => void;
}

export function useChatStream({
  endpoint,
  payload,
  initialMessages = [],
  onSettled,
  onTransferred,
}: UseChatStreamOptions) {
  const [messages, setMessages] = React.useState<ChatBubble[]>(initialMessages);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryable, setRetryable] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  // Kept in a ref so `send` does not need to be re-created when the payload
  // changes mid-conversation (e.g. the passcode being entered).
  const payloadRef = React.useRef(payload);
  React.useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);
  const lastSentRef = React.useRef<string | null>(null);

  const reset = React.useCallback((next: ChatBubble[] = []) => {
    abortRef.current?.abort();
    setMessages(next);
    setError(null);
    setSending(false);
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return;

      lastSentRef.current = trimmed;
      setError(null);
      setSending(true);

      const userBubble: ChatBubble = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `a-${Date.now()}`;
      setMessages((current) => [
        ...current,
        userBubble,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (update: (bubble: ChatBubble) => ChatBubble) =>
        setMessages((current) =>
          current.map((bubble) => (bubble.id === assistantId ? update(bubble) : bubble)),
        );

      let failed = false;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadRef.current, message: trimmed }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? `Request failed (${response.status}).`);
        }

        for await (const raw of readSseStream(response, controller.signal)) {
          const event = raw as RuntimeEvent;

          switch (event.type) {
            case "text":
              patchAssistant((bubble) => ({
                ...bubble,
                content: bubble.content + event.text,
              }));
              break;

            case "tool_start":
              patchAssistant((bubble) => ({
                ...bubble,
                activity: [
                  ...(bubble.activity ?? []),
                  { id: event.id, name: event.name, state: "running" },
                ],
              }));
              break;

            case "tool_end":
              patchAssistant((bubble) => ({
                ...bubble,
                activity: (bubble.activity ?? []).map((item) =>
                  item.id === event.id
                    ? { ...item, state: "done" as const, detail: describeEffect(event) }
                    : item,
                ),
              }));
              break;

            case "error":
              failed = true;
              setError(event.message);
              setRetryable(event.retryable);
              break;

            case "transferred":
              onTransferred?.(event.toAgentId, event.toAgentName);
              break;

            case "persisted":
              patchAssistant((bubble) => ({
                ...bubble,
                serverId: event.messageId,
                persisted: true,
              }));
              break;

            case "handled_by_human":
              // A colleague has the conversation; their reply arrives over the
              // live feed, so there is nothing to stream for this turn.
              break;

            case "done":
              break;
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          // User navigated away or cancelled; not an error worth showing.
        } else {
          failed = true;
          setError(
            caught instanceof Error
              ? caught.message
              : "The reply could not be delivered.",
          );
          setRetryable(true);
        }
      } finally {
        abortRef.current = null;
        setSending(false);

        setMessages((current) => {
          const next = current.map((bubble) =>
            bubble.id === assistantId ? { ...bubble, streaming: false } : bubble,
          );
          // An assistant bubble that produced neither text nor tool activity is
          // an empty shell; drop it so the error state stands alone.
          const assistant = next.find((bubble) => bubble.id === assistantId);
          if (assistant && !assistant.content.trim() && !assistant.activity?.length) {
            return next.filter((bubble) => bubble.id !== assistantId);
          }
          return next;
        });

        if (!failed) onSettled?.();
      }
    },
    [endpoint, onSettled, onTransferred],
  );

  /** Re-sends the last message after a failure, dropping the failed exchange. */
  const retry = React.useCallback(() => {
    const last = lastSentRef.current;
    if (!last) return;
    setMessages((current) => {
      const index = current.findLastIndex(
        (bubble) => bubble.role === "user" && bubble.content === last,
      );
      return index === -1 ? current : current.slice(0, index);
    });
    void send(last);
  }, [send]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  }, []);

  /** Records a rating locally; the caller persists it. */
  const setRating = React.useCallback((serverId: string, rating: 1 | -1 | null) => {
    setMessages((current) =>
      current.map((bubble) =>
        (bubble.serverId ?? bubble.id) === serverId ? { ...bubble, rating } : bubble,
      ),
    );
  }, []);

  /**
   * Appends a turn that did not come from this client's own request - a
   * colleague replying from the inbox. Ignores anything already present, since
   * the live feed can overlap with a reload.
   */
  const receive = React.useCallback((bubble: ChatBubble) => {
    setMessages((current) =>
      current.some((existing) => existing.id === bubble.id)
        ? current
        : [...current, bubble],
    );
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return {
    messages,
    setMessages,
    send,
    retry,
    stop,
    reset,
    receive,
    setRating,
    sending,
    error,
    retryable,
  };
}
