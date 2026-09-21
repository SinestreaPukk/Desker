"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
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
      className={cn("border-t border-line bg-surface p-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2",
          "transition-colors focus-within:border-accent focus-within:outline-2 focus-within:outline-accent",
          disabled && "opacity-60",
        )}
      >
        <label htmlFor="chat-composer" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={1}
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
            "flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink",
            "placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed",
          )}
        />

        {sending && onStop ? (
          <Button
            type="button"
            size="icon-sm"
            variant="subtle"
            onClick={onStop}
            aria-label="Stop generating"
            className="mb-0.5 rounded-md"
          >
            <Square className="fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            disabled={!value.trim() || sending || disabled}
            aria-label="Send message"
            className="mb-0.5 rounded-md"
          >
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>
      <p className="mt-1.5 px-1 text-xs text-ink-subtle">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  );
}
