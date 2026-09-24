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

/**
 * The one content column.
 *
 * The rules that divide a page - under the title, under the toolbar - run the
 * full width, because they divide the page. What sits between them does not:
 * on a wide monitor an inbox row was stretching past 1700px, which put the
 * agent's name and the time it last moved a screen apart, and pushed the
 * toolbar's controls a thousand pixels from the tabs they filter. Everything
 * that is read lines up in one column instead, and the page keeps its
 * full-bleed edges.
 *
 * It only bites past roughly 1700px of viewport; below that nothing moves.
 */
const COLUMN = "mx-auto w-full max-w-[90rem]";

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
    // The rule runs the full width of the page; what it divides does not.
    <div className={cn("border-b border-line bg-surface/40 backdrop-blur-xs", className)}>
      <div
        className={cn(
          "flex flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6",
          "md:flex-row md:items-start md:justify-between",
          // A fixed minimum keeps the header the same height whether or not a
          // page supplies a description or actions.
          "md:min-h-[6.25rem]",
          COLUMN,
        )}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
      </div>
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
  stack = false,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Keep the children on separate rows at every width, and let the strip take
   * the height it needs. For a toolbar carrying more than a page's width of
   * controls - the Inbox's four tabs plus its four filters - where the single
   * row would otherwise overflow its fixed height and print over the list.
   */
  stack?: boolean;
}) {
  return (
    <div className={cn("border-b border-line bg-surface/20 backdrop-blur-xs", className)}>
      <div
        className={cn(
          "flex flex-col gap-3 px-4 py-3 sm:px-6",
          // A fixed height once the row fits on one line, so the content below
          // starts at exactly the same y on every tab. Controls of differing
          // heights (a tab strip vs a select) would otherwise shift it by a few
          // pixels, which is visible as a jump when switching tabs.
          !stack && "lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0",
          COLUMN,
        )}
      >
        {children}
      </div>
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
  return <div className={cn("flex-1 p-4 sm:p-6", COLUMN, className)}>{children}</div>;
}
