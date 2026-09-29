import { cn } from "@/lib/utils";

/**
 * The public site's calls to action, as pills: CTA_PRIMARY in the ink blue,
 * the one solid colour on the page; CTA_SECONDARY white with a hairline;
 * CTA_NAV the header's smaller primary. Press and hover live in globals.css
 * (.cta-primary, .cta-secondary, .nav-cta).
 */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const CTA_PRIMARY = cn(
  // The label in the hand: the one call on the page reads as written.
  "cta-primary inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-full px-7 font-hand text-hand-cta font-bold",
  FOCUS,
  "[&_svg]:size-4",
);

export const CTA_SECONDARY = cn(
  "cta-secondary inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-full px-7 text-base font-semibold",
  FOCUS,
  "[&_svg]:size-4",
);

export const CTA_NAV = cn(
  "nav-cta inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 font-hand text-xl leading-none font-bold pointer-coarse:h-11",
  FOCUS,
);
