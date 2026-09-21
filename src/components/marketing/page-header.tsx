import { Clouds } from "@/components/marketing/landing-blocks";
import { Parallax } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * The top of every public page that is not the landing page.
 *
 * The landing page opens on a full morning sky; these open on a band of the
 * same one, so arriving at the showcase or the terms from the front door does
 * not feel like arriving at a different company. The gradient's stops are
 * percentages of the section's own height, so the same rule that puts the
 * horizon below the hero's text puts it below this band's - the copy always
 * sits on the deep plateau that clears 4.5:1 against white.
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
    <section className={cn("sky relative -mt-14 pt-14", className)}>
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div className="sun right-[14%] top-[66%] hidden lg:block" />
        <Parallax className="absolute inset-0" distance={-24}>
          <Clouds />
        </Parallax>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-12 sm:px-6 sm:pb-36 sm:pt-16">
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
