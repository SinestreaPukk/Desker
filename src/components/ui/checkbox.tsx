"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A native checkbox in the brand colour (accent-color does the fill). Keeps the
 * `onCheckedChange(boolean)` shape the call sites already use.
 */
export function Checkbox({
  className,
  onChange,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { onCheckedChange?: (checked: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className={cn(
        "peer size-[1.125rem] shrink-0 cursor-pointer accent-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      {...props}
    />
  );
}
