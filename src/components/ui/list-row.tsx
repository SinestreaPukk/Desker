import * as React from "react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * The one list-item layout: a leading figure (avatar or icon), a title line
 * with its badges, a body line, a metadata line, and an optional trailing
 * action. Conversations, issues and approvals all read the same way, so
 * switching tabs feels like the same product.
 */
export function ListRow({
  leading,
  title,
  badges,
  body,
  meta,
  trailing,
  muted,
  className,
}: {
  leading: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Resolved / done items step back without disappearing. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <Panel
      className={cn(
        "relative transition-shadow focus-within:shadow-sm hover:shadow-sm",
        muted && "opacity-70",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">{leading}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {badges}
          </div>
          {body ? <div className="mt-1 text-sm leading-relaxed">{body}</div> : null}
          {meta ? <p className="mt-2 flex flex-wrap items-center gap-x-2 meta">{meta}</p> : null}
        </div>
        {trailing ? <div className="relative z-10 shrink-0">{trailing}</div> : null}
      </div>
    </Panel>
  );
}

/** A square icon tile for rows that have no avatar. */
export function RowIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-muted [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
