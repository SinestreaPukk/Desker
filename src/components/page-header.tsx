import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every admin page sits in.
 *
 * Its point is that the geometry never changes between tabs: the same header
 * height, the same content padding, the same max width. Switching from the
 * roster to the inbox to insights swaps the body and moves nothing else, so
 * the sidebar, the title row and the first row of content stay put under the
 * cursor.
 */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-line px-4 py-5 sm:px-6 sm:py-6",
        "md:flex-row md:items-start md:justify-between",
        // A fixed minimum keeps the header the same height whether or not a
        // page supplies a description or actions.
        "md:min-h-[6.25rem]",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink sm:text-xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * An optional filter/controls strip directly under the header. Pages that have
 * one all get the same height and padding, so the content below starts at the
 * same y position.
 */
export function PageToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6",
        // A fixed height once the row fits on one line, so the content below
        // starts at exactly the same y on every tab. Controls of differing
        // heights (a tab strip vs a select) would otherwise shift it by a few
        // pixels, which is visible as a jump when switching tabs.
        "lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex-1 p-4 sm:p-6", className)}>{children}</div>;
}
