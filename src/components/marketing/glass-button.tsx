import { cn } from "@/lib/utils";

/**
 * The call to action on the sky: white with an indigo label. Used in the
 * hero and the closing call; the header uses the _SM one, which is solid
 * indigo once the header frosts over (see .nav-cta in globals.css).
 */
export const GLASS_BUTTON = cn(
  "cta-sky inline-flex min-h-[44px] h-11 items-center justify-center gap-2 rounded-lg px-6 text-base font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "[&_svg]:size-4",
);

export const GLASS_BUTTON_SM = cn(
  "nav-cta inline-flex min-h-[36px] h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);

/**
 * The quiet partner to the primary button: an honest link on the sky.
 */
export const SKY_LINK = cn(
  "group inline-flex min-h-[44px] h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-[var(--sky-ink)] underline-offset-4 hover:underline",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "[&_svg]:size-4 [&_svg]:transition-transform group-hover:[&_svg]:translate-x-0.5",
);
