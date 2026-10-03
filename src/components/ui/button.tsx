"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/shared/utils";

// On touch screens the small sizes get an invisible hit area reaching 44px,
// so a row of 28-32px buttons (Remove, Snooze) is not a row of mis-taps.
const touchArea = "pointer-coarse:after:absolute pointer-coarse:after:content-['']";

const button = cva(
  // Pills, as on the public site.
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
    // The press is the feedback: it lands on pointer-down, 150ms, strong ease-out.
    "transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg hover:bg-primary-hover shadow-xs hover:shadow-sm active:scale-[0.97] ring-1 ring-inset ring-white/40",
        secondary:
          "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 shadow-xs active:scale-[0.97]",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-[0.97]",
        subtle: "bg-surface-2 text-ink hover:bg-surface-3 active:scale-[0.97]",
        danger:
          "bg-danger text-danger-fg hover:brightness-110 shadow-xs hover:shadow-sm active:scale-[0.97] ring-1 ring-inset ring-white/20",
        link: "text-accent underline underline-offset-4 hover:text-accent-hover",
      },
      size: {
        sm: `h-8 px-3 text-sm [&_svg]:size-3.5 ${touchArea} pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5`,
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-[1.125rem]",
        icon: `size-9 [&_svg]:size-4 ${touchArea} pointer-coarse:after:-inset-1`,
        "icon-sm": `size-7 [&_svg]:size-3.5 ${touchArea} pointer-coarse:after:-inset-2`,
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof button> {
  asChild?: boolean;
  /** Shows a spinner and blocks interaction. Width stays stable to avoid layout jump. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span className="sr-only">Working…</span>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
