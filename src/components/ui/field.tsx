"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium text-ink leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

const fieldStyles =
  "w-full rounded-lg border border-line-strong/80 bg-surface px-3 text-sm text-ink " +
  "placeholder:text-ink-subtle shadow-2xs transition-all duration-150 " +
  "hover:border-ink-subtle " +
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent focus-visible:ring-2 focus-visible:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export function Input({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return <input className={cn(fieldStyles, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldStyles, "min-h-24 py-2.5 leading-relaxed resize-y", className)}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  /** Placed on the right of the label row - character counts, inline actions. */
  aside?: React.ReactNode;
  /** Placed inline next to the control - action buttons, suffix addons. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Label + control + hint + error, wired together with the aria attributes a
 * screen reader needs. Every form in the app uses this so no field can quietly
 * ship without an accessible name or an announced error.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  aside,
  action,
  children,
  className,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="text-danger ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {aside}
      </div>

      {/* Children receive the aria wiring without each form repeating it. */}
      {(() => {
        const control = React.isValidElement<Record<string, unknown>>(children)
          ? React.cloneElement(children, {
              id: htmlFor,
              "aria-describedby":
                [hintId, errorId].filter(Boolean).join(" ") || undefined,
              "aria-invalid": error ? true : undefined,
              "aria-required": required || undefined,
            })
          : children;

        if (!action) return control;

        return (
          <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
            {control}
            {action}
          </div>
        );
      })()}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted leading-relaxed">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs text-danger leading-relaxed"
        >
          <AlertCircle className="size-3.5 mt-px shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
