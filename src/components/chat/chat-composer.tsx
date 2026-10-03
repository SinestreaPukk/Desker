"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/utils";

export function ChatComposer({
  onSend,
  onStop,
  sending,
  disabled,
  placeholder = "Type your message…",
  autoFocus,
  className,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to a cap, then scroll.
  const resize = React.useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 280)}px`;
  }, []);

  React.useEffect(resize, [value, resize]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form
      className={cn("bg-transparent", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "relative rounded-panel border border-line-strong/40 bg-surface p-4 shadow-sm",
          "transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15",
        )}
      >
        <label htmlFor="chat-composer" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={3}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. Never hijack IME composition.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className={cn(
            "block min-h-[4.5rem] w-full resize-none bg-transparent pb-9 pr-12 text-base leading-relaxed text-ink",
            "placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed",
          )}
        />

        {sending && onStop ? (
          <Button type="button" size="icon" variant="subtle" onClick={onStop} aria-label="Stop generating" className="absolute bottom-3 right-3">
            <Square className="fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim() || sending || disabled}
            aria-label="Send message"
            className="absolute bottom-3 right-3"
          >
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-ink-muted">AI can make mistakes. Check important information.</p>
    </form>
  );
}
