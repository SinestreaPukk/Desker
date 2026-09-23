import { cn } from "@/lib/utils";

/**
 * The call to action on the sky: white with an indigo label. Used in the
 * hero and the closing call; the header uses the _SM one, which is solid
 * indigo once the header frosts over (see .nav-cta in globals.css).
 */
export const GLASS_BUTTON = cn(
  "cta-sky inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "[&_svg]:size-4",
);

export const GLASS_BUTTON_SM = cn(
  "nav-cta inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);

/**
 * The quiet partner to the glass button.
 *
 * The hero offers two things to do, and they are not equal: one is the page's
 * single strongest call, the other is a way to browse first. A second filled
 * button beside the first would split that. This is a link, and reads as one -
 * the arrow leans forward on hover, and nothing else about it competes.
 */
export const SKY_LINK = cn(
  "group inline-flex h-11 items-center gap-1.5 rounded-md px-1 text-base font-medium text-[var(--sky-ink)]",
  "underline-offset-4 hover:underline",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sky-deep)]",
  "[&_svg]:size-4 [&_svg]:transition-transform group-hover:[&_svg]:translate-x-0.5",
);
