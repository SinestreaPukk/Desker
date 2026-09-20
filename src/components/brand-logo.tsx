import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The Desker logo.
 *
 * The artwork is a single-colour mask rather than two exported images, and the
 * colour comes from a design token - so the mark follows the theme
 * automatically and the light and dark variants cannot drift apart. Source
 * assets are generated from the original artwork by
 * scripts/make-brand-assets.mjs.
 */
const MASK = {
  mark: "/brand/desker-mark.png",
  wordmark: "/brand/desker-wordmark.png",
  lockup: "/brand/desker-lockup.png",
} as const;

function maskStyle(url: string): React.CSSProperties {
  return {
    // Both spellings: Safari still needs the prefixed property.
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

/** The `d` mark on its own - sidebars, avatars, tight spaces. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={BRAND.name}
      style={maskStyle(MASK.mark)}
      className={cn("inline-block size-6 shrink-0 bg-accent", className)}
    />
  );
}

/** The wordmark without the tagline. The default for anything compact. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={BRAND.name}
      style={maskStyle(MASK.wordmark)}
      // Aspect ratio pinned to the source artwork so the mask cannot stretch.
      className={cn("inline-block aspect-[1616/720] h-8 bg-accent", className)}
    />
  );
}

/**
 * The full lockup: wordmark plus "Agentic AI Platform".
 *
 * The tagline is only ~18% of the artwork's height, so it needs around 64px to
 * stay legible - hence the h-16 default. Below that use `BrandWordmark`, which
 * drops the tagline rather than rendering it as mush.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${BRAND.name} — ${BRAND.tagline}`}
      style={maskStyle(MASK.lockup)}
      className={cn("inline-block aspect-[1734/722] h-16 bg-accent", className)}
    />
  );
}
