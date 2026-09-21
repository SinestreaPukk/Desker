"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
    "transition-[background-color,border-color,color,box-shadow] duration-150 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm active:translate-y-px",
        secondary:
          "bg-surface text-ink border border-line-strong hover:bg-surface-2 active:translate-y-px",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        subtle: "bg-surface-2 text-ink hover:bg-surface-3",
        danger:
          "bg-danger text-white hover:brightness-110 shadow-sm active:translate-y-px",
        link: "text-accent underline underline-offset-4 hover:text-accent-hover",
      },
      size: {
        sm: "h-8 px-3 text-sm [&_svg]:size-3.5",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-[1.125rem]",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-7 [&_svg]:size-3.5",
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

export { button as buttonVariants };
