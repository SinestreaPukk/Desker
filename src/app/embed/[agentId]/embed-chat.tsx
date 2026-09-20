"use client";

import * as React from "react";
import { ClientChat } from "@/components/chat/client-chat";

export function EmbedChat({ agentId }: { agentId: string }) {
  const close = React.useCallback(() => {
    // The loader script owns the panel; ask it to collapse.
    window.parent?.postMessage({ type: "desker:close" }, "*");
  }, []);

  // Escape must close the widget even when focus is inside this iframe - the
  // host page never receives a keydown that happens in a cross-origin frame.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return <ClientChat agentId={agentId} variant="widget" onClose={close} />;
}
