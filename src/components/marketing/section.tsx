import { cn } from "@/lib/utils";
import { Words } from "@/components/marketing/words";

/**
 * The landing page's one section shell: one max width, one gutter, one
 * vertical rhythm. Every section goes through here so the spacing scale is a
 * decision made once - py-20 on a phone, py-28 from sm - not per section.
 */
export function Section({
  id,
  className,
  containerClassName,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  /** The id of the heading that names this section for assistive tech. */
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-14", className)}>
      <div className={cn("mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28", containerClassName)}>{children}</div>
    </section>
  );
}

/** Eyebrow, heading, intro - the pattern every section opens with. */
export function SectionHeader({
  id,
  eyebrow,
  heading,
  intro,
  align = "center",
  tone = "default",
  className,
}: {
  /** Put on the heading, for the section's aria-labelledby. */
  id?: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  align?: "center" | "left";
  /** "inverse" for a section on the indigo band. */
  tone?: "default" | "inverse";
  className?: string;
}) {
  const inverse = tone === "inverse";
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
      <p className={cn("eyebrow sd-rise", inverse ? "text-accent-fg/80" : "text-accent")}>{eyebrow}</p>
      <h2 id={id} className={cn("mt-3 text-title text-balance", inverse ? "text-accent-fg" : "text-ink")}>
        <Words text={heading} />
      </h2>
      {intro ? (
        <p
          className={cn(
            "sd-rise mt-4 text-lg leading-relaxed text-pretty",
            align === "center" && "mx-auto max-w-2xl",
            inverse ? "text-accent-fg/85" : "text-ink-muted",
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}
