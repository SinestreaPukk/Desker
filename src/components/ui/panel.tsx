import * as React from "react";
import { cn } from "@/lib/shared/utils";

/** The one surface primitive: an inset group, white on the grouped ground. */
export function Panel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line/50 bg-surface",
        "transition-[border-color,box-shadow,transform]",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 p-5 pb-4", className)}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-base font-semibold tracking-tight text-ink", className)} {...props} />
  );
}

export function PanelDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs leading-relaxed text-ink-muted mt-1 max-w-xl", className)}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-line bg-surface-2/40 px-5 py-3.5 rounded-b-panel",
        className,
      )}
      {...props}
    />
  );
}
