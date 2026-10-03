/**
 * The tour's infographics: small, simplified drawings of the real screens,
 * with numbered marks on the exact places to press. Drawn in the app's own
 * tokens rather than screenshots, so they stay true when the product changes
 * colour, work in both themes, and read clearly at dialog size.
 */
import * as React from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/shared/utils";

/** A numbered mark: "press here". Its number matches a line in the callouts below the drawing. */
export function Mark({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-5 shrink-0 items-center justify-center", className)} aria-hidden>
      <span className="absolute inset-0 rounded-full bg-accent/30 motion-safe:animate-ping" />
      <span className="relative flex size-5 items-center justify-center rounded-full bg-accent text-meta font-semibold leading-none text-accent-fg ring-2 ring-surface">
        {n}
      </span>
    </span>
  );
}

/** The drawing's frame: a window with the sidebar on the left and one screen beside it. */
export function MiniScreen({
  nav,
  active,
  marks = {},
  children,
}: {
  nav: string[];
  /** The sidebar item that is selected on this screen. */
  active?: string;
  /** Sidebar items that carry a numbered mark. */
  marks?: Record<string, number>;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper" role="img" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
        <span className="size-2 rounded-full bg-surface-3" />
        <span className="size-2 rounded-full bg-surface-3" />
        <span className="size-2 rounded-full bg-surface-3" />
        <span className="ml-2 text-xs font-semibold text-ink">Desker</span>
      </div>
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)]">
        <ul className="space-y-0.5 border-r border-line bg-rail p-2">
          {nav.map((item) => (
            <li
              key={item}
              className={cn(
                "flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs",
                item === active ? "bg-accent-soft font-semibold text-accent-soft-fg" : "text-ink-muted",
              )}
            >
              <span className="truncate">{item}</span>
              {marks[item] ? <Mark n={marks[item]} /> : null}
            </li>
          ))}
        </ul>
        <div className="min-w-0 space-y-2 p-3">{children}</div>
      </div>
    </div>
  );
}

/** A white block inside a drawing: a card, a panel or a form. */
export function MiniCard({ title, children, className }: { title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-line bg-surface p-2.5", className)}>
      {title ? <p className="text-xs font-semibold text-ink">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1.5", "space-y-1.5")}>{children}</div> : null}
    </div>
  );
}

/** Grey lines standing in for text the reader doesn't need to read. */
export function MiniLines({ count = 2, widths = ["w-full", "w-4/5", "w-3/5"] }: { count?: number; widths?: string[] }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn("h-1.5 rounded-full bg-surface-3", widths[index % widths.length])} />
      ))}
    </div>
  );
}

/** A button in a drawing, with an optional mark beside it. */
export function MiniButton({
  label,
  variant = "secondary",
  mark,
}: {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  mark?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium",
          variant === "primary" && "bg-primary text-primary-fg",
          variant === "secondary" && "border border-line bg-surface text-ink",
          variant === "ghost" && "text-ink-muted",
        )}
      >
        {label}
      </span>
      {mark ? <Mark n={mark} /> : null}
    </span>
  );
}

/** A left-to-right chain: how work moves from one hand to the next. */
export function Flow({ steps }: { steps: { label: string; detail?: string; you?: boolean }[] }) {
  return (
    <ol className="flex flex-col items-stretch gap-1 sm:flex-row" role="img" aria-hidden>
      {steps.map((step, index) => (
        <React.Fragment key={step.label}>
          <li
            className={cn(
              "flex-1 rounded-md border p-3",
              step.you ? "border-accent-line bg-accent-soft" : "border-line bg-surface",
            )}
          >
            <p className={cn("text-xs", step.you ? "text-accent-soft-fg" : "text-ink-muted")}>Step {index + 1}</p>
            <p className={cn("text-sm font-semibold", step.you ? "text-accent-soft-fg" : "text-ink")}>{step.label}</p>
            {step.detail ? <p className="mt-0.5 text-xs text-ink-muted">{step.detail}</p> : null}
          </li>
          {index < steps.length - 1 ? (
            <li className="flex items-center justify-center text-ink-subtle sm:px-1">
              <ArrowRight className="hidden size-4 sm:block" />
              <ArrowDown className="size-4 sm:hidden" />
            </li>
          ) : null}
        </React.Fragment>
      ))}
    </ol>
  );
}

/** The numbered lines under a drawing: what each mark means. */
export function Callouts({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5">
      {items.map((item, index) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
          <Mark n={index + 1} className="mt-px [&>span:first-child]:hidden" />
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
