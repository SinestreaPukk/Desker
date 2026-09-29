import { cn } from "@/lib/utils";
import type { NoteTone } from "@/components/ui/note";

/**
 * A small handwritten tab above a group, the way the public site heads its
 * sections: a note-coloured slip with the label in the hand. For group
 * headings in the app ("Waiting on you", "Finished"), never for anything
 * that needs scanning at speed.
 */
export function SectionTab({
  tone = "lemon",
  className,
  children,
}: {
  tone?: NoteTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn("inline-block rounded-sm px-2 py-0.5 font-hand text-xl leading-snug font-bold text-note-ink", className)}
      style={{ background: `color-mix(in oklch, var(--note-${tone}) 80%, var(--surface))` }}
    >
      {children}
    </span>
  );
}
