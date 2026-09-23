import { NightSky } from "@/components/marketing/night-sky";
import { cn } from "@/lib/utils";

/**
 * The top of every public page that is not the landing page.
 *
 * The landing page opens on a full morning sky; these open on a band of the
 * same one, so arriving at the showcase or the terms from the front door does
 * not feel like arriving at a different company.
 *
 * The band's horizon is anchored to its bottom edge rather than set as a
 * percentage, because a header's height swings by hundreds of pixels as the
 * title and intro rewrap - see .sky-band. Everything inside the bottom
 * padding is therefore on the deep plateau, which clears 4.5:1 against white
 * at every width. Put nothing below that padding.
 */
export function PageHeader({
  title,
  intro,
  eyebrow,
  children,
  className,
}: {
  title: string;
  intro?: string;
  /** A small mono line above the title - a version, a count, a category. */
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("sky-band relative -mt-14 pt-14", className)}>
      {/* The same night sky as the landing page, clipped to the band. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <NightSky uid="header-sky" />
      </div>

      {/* pb must stay at or above the 8rem the fade is anchored at, so the
          copy is always on the deep plateau. */}
      <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-12 sm:px-6 sm:pb-44 sm:pt-16">
        {eyebrow ? (
          <p className="meta mb-3 text-[var(--sky-ink)]">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl font-display text-title text-balance text-[var(--sky-ink)]">{title}</h1>
        {intro ? (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--sky-ink)]">{intro}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
