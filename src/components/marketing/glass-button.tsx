import { cn } from "@/lib/utils";

/** The one glass button. Used in the hero, the sticky header and the closing call. */
export const GLASS_BUTTON = cn(
  "glass inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "[&_svg]:size-4",
);

export const GLASS_BUTTON_SM = cn(
  "glass inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-glass)] focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);
