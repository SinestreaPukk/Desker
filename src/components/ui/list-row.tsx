import * as React from "react";
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
  aside,
  trailing,
  muted,
  className,
}: {
  leading: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  /**
   * Right-aligned metadata - a timestamp, a count. Deliberately not inside
   * the `relative z-10` the trailing slot gets: a row like this is one
   * stretched link, and anything lifted above it would punch a dead patch in
   * the click target. This is read, not clicked.
   */
  aside?: React.ReactNode;
  /** An interactive control at the right: a button, a menu. */
  trailing?: React.ReactNode;
  /** Resolved / done items step back without disappearing. */
  muted?: boolean;
  className?: string;
}) {
  // A row in an inset group (the list around it is the Panel): the separator
  // starts past the leading figure, as in a native list, and the last row has none.
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3.5 pl-4 transition-colors duration-150 has-[a:hover]:bg-surface-2/70 has-[a:active]:bg-surface-2",
        muted && "opacity-70",
        className,
      )}
    >
      <div className="mt-3.5 shrink-0">{leading}</div>
      <div className="flex min-w-0 flex-1 items-start gap-3.5 border-b border-line/70 py-3.5 pr-4 group-last/row:border-b-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {badges}
          </div>
          {body ? <div className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</div> : null}
          {meta ? <p className="mt-2 flex flex-wrap items-center gap-x-2 meta">{meta}</p> : null}
        </div>
        {aside ? <p className="meta shrink-0 whitespace-nowrap pt-0.5">{aside}</p> : null}
        {trailing ? <div className="relative z-10 shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

/** A square icon tile for rows that have no avatar. */
export function RowIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center rounded-lg border border-line bg-surface-2/80  text-ink-muted [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
