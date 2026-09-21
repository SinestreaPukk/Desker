"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-surface-3", className)}
      aria-hidden
      {...props}
    />
  );
}

/**
 * Designed empty state. Every list in the app uses this rather than printing
 * "No data" - an empty roster should tell you what to do next.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-panel border border-dashed border-line-strong",
        "bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-accent-line bg-accent-soft">
        <Icon className="size-5 text-accent-soft-fg" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Error state with a retry affordance. `role="alert"` so the failure is
 * announced rather than silently replacing a spinner.
 */
export function ErrorState({
  title = "That didn't load",
  message,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-panel border border-danger-line bg-danger-soft p-5",
        "sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="text-sm font-medium text-danger">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-danger/90">
            {message}
          </p>
        </div>
      </div>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          loading={retrying}
          className="shrink-0"
        >
          <RefreshCw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Inline form-level error, for a submit that failed rather than a load. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2.5 text-sm leading-relaxed text-danger"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-panel" />
      ))}
    </div>
  );
}

/** Card-shaped placeholders for a grid, so the real cards land where the skeletons were. */
export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded-panel border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-2/3" />
        </li>
      ))}
    </ul>
  );
}

/** A KPI row placeholder: one lead number beside a 2x2 of secondary stats. */
export function LoadingKpis() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" aria-busy>
      <span className="sr-only">Loading…</span>
      <div className="rounded-panel border border-line bg-surface p-5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-4 h-10 w-1/2" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-panel border border-line bg-surface p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-3 h-6 w-1/3" />
            <Skeleton className="mt-3 h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
