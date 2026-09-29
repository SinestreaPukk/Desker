import { cn } from "@/lib/utils";
import { SoftNotes } from "@/components/marketing/desk-notes";

/**
 * The top of every public page that is not the landing page: the desk with
 * its out-of-focus notes, a small sticky-note tab, a bold title and an intro. The band's
 * padding leaves room for a panel to rise into it (the contact form).
 */
export function PageHeader({
  title,
  intro,
  eyebrow,
  hand = false,
  children,
  className,
}: {
  title: string;
  intro?: string;
  /** The title in the hand (Caveat), for the pages where the visitor acts. */
  hand?: boolean;
  /** A short label above the title - a version, a count, a category. */
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative -mt-14 overflow-hidden pt-14", className)}>
      <SoftNotes preset="header" />
      <div className="relative mx-auto max-w-6xl px-4 pb-36 pt-14 sm:px-6 sm:pb-40 sm:pt-20">
        {eyebrow ? (
          <p className="mb-4 inline-block rounded-sm bg-note-sky px-2.5 py-1 text-xs font-semibold tracking-wide text-note-ink">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={cn("max-w-3xl text-balance text-ink", hand ? "font-hand text-hand-title" : "text-title font-bold")}>
          {title}
        </h1>
        {intro ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-ink-muted">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
