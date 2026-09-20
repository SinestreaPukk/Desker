"use client";

import * as React from "react";

interface LiveMessage {
  messageId: string;
  role: "human" | "assistant";
  authorName: string | null;
  content: string;
  createdAt: string;
}

/**
 * Subscribes a client's chat window to turns it did not request.
 *
 * Without this, a colleague can type into the transcript and the client never
 * sees it. EventSource is used rather than a poll because it reconnects on its
 * own and costs nothing while idle.
 */
export function useClientLiveFeed(
  url: string | undefined,
  handlers: {
    onMessage: (message: LiveMessage) => void;
    onMode?: (mode: "agent" | "human") => void;
  },
) {
  // Held in a ref so a changing callback identity does not tear down and
  // re-open the connection on every render.
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  React.useEffect(() => {
    if (!url) return;

    const source = new EventSource(url);

    source.onmessage = (event) => {
      let payload: { type?: string } & Partial<LiveMessage> & { mode?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "message" && payload.messageId && payload.content) {
        handlersRef.current.onMessage({
          messageId: payload.messageId,
          role: payload.role ?? "human",
          authorName: payload.authorName ?? null,
          content: payload.content,
          createdAt: payload.createdAt ?? new Date().toISOString(),
        });
      }

      if (payload.type === "mode" && (payload.mode === "agent" || payload.mode === "human")) {
        handlersRef.current.onMode?.(payload.mode);
      }
    };

    // EventSource retries on its own; logging every blip would be noise.
    source.onerror = () => {};

    return () => source.close();
  }, [url]);
}
