import { cn } from "@/lib/utils";

/**
 * Small drawings for the six trust promises, in the sticky notes' own hand:
 * a navy line with rounded ends, white paper parts and one note colour each,
 * drawn on a 64-unit grid so they sit at one weight beside each other. Each
 * shows the promise as a thing on the desk rather than as a UI glyph.
 * Decorative: the promise's title is always beside it.
 */
export type PromiseDoodleId = "draft" | "person" | "source" | "log" | "lock" | "handoff";

const INK = {
  stroke: "var(--note-ink)",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const PAPER = "oklch(1 0 0)";

export function PromiseDoodle({ id, className }: { id: PromiseDoodleId; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", className)} {...INK} fill="none">
      {DRAWINGS[id]}
    </svg>
  );
}

const DRAWINGS: Record<PromiseDoodleId, React.ReactNode> = {
  // Draft-only by default: a notepad with a pencil resting on it, the last
  // line still a squiggle.
  draft: (
    <>
      <rect x="10" y="12" width="32" height="42" rx="4" fill={PAPER} />
      <circle cx="17" cy="12" r="2.5" fill={PAPER} />
      <circle cx="26" cy="12" r="2.5" fill={PAPER} />
      <circle cx="35" cy="12" r="2.5" fill={PAPER} />
      <path d="M17 24h18M17 31h18M17 38c2.5-3 5 3 7.5 0s5 3 7.5 0" />
      <g transform="rotate(35 46 36)">
        <rect x="41" y="14" width="10" height="30" rx="2" fill="var(--note-sky)" />
        <path d="M41 20h10" />
        <path d="M41 44l5 9 5-9" fill={PAPER} />
        <path d="M44.6 50.5l1.4 2.5 1.4-2.5" fill="var(--note-ink)" />
      </g>
    </>
  ),
  // You approve every send: a sealed envelope, and your round check sticker.
  person: (
    <>
      <rect x="6" y="16" width="42" height="30" rx="4" fill={PAPER} />
      <path d="M8 19l19 14 19-14" />
      <circle cx="46" cy="44" r="11" fill="var(--note-mint)" />
      <path d="M40.5 44.5l3.8 3.8 7-7.6" />
    </>
  ),
  // Answers name their source: an open book, and a quote coming out of it.
  source: (
    <>
      <path d="M32 26c-6-4-14-5-22-3v26c8-2 16-1 22 3z" fill={PAPER} />
      <path d="M32 26c6-4 14-5 22-3v26c-8-2-16-1-22 3z" fill={PAPER} />
      <path d="M32 26v26M16 31c3-.6 6-.5 9 .4M16 37c3-.6 6-.5 9 .4" />
      <path d="M38 5h18a4 4 0 014 4v8a4 4 0 01-4 4h-9l-5 5v-5h-4a4 4 0 01-4-4V9a4 4 0 014-4z" fill="var(--note-lilac)" />
      <path d="M43 11.5c0 2.6-1 4-2.6 4.6M51 11.5c0 2.6-1 4-2.6 4.6" />
      <circle cx="43" cy="11.5" r="1.4" fill="var(--note-ink)" />
      <circle cx="51" cy="11.5" r="1.4" fill="var(--note-ink)" />
    </>
  ),
  // A full audit log: a clipboard of ticked lines, and the clock on it all.
  log: (
    <>
      <rect x="9" y="10" width="34" height="46" rx="4" fill={PAPER} />
      <rect x="18" y="6" width="16" height="9" rx="3" fill="var(--note-sky)" />
      <path d="M16 25l2.6 2.6 4.4-4.6M28 25h9M16 35l2.6 2.6 4.4-4.6M28 35h9M28 45h9" />
      <rect x="16" y="42" width="6.5" height="6.5" rx="1.6" />
      <circle cx="47" cy="47" r="10" fill="var(--note-lemon)" />
      <path d="M47 41.5V47l3.5 2.5" />
    </>
  ),
  // Your documents are yours: your folder, with your padlock on it.
  lock: (
    <>
      <path d="M6 20a4 4 0 014-4h11l4.5 4.5H44a4 4 0 014 4V46a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill={PAPER} />
      <path d="M38 40v-5a7 7 0 0114 0v5" />
      <rect x="34" y="40" width="22" height="16" rx="4" fill="var(--note-coral)" />
      <circle cx="45" cy="46.5" r="2" fill="var(--note-ink)" />
      <path d="M45 48.5v3" />
    </>
  ),
  // It knows when to stop: a raised hand, open, calm - "one moment".
  handoff: (
    <>
      <path
        d="M24 56c-7 0-12-5-12-12V29a3.5 3.5 0 017 0v7V17a3.5 3.5 0 017 0v17V13a3.5 3.5 0 017 0v21V18a3.5 3.5 0 017 0v19l4-5.5a3.5 3.5 0 015.6 4.2L42 49c-3 5-8 7-12 7z"
        fill={PAPER}
      />
      <path d="M50 12l5-4M53 20l6-1M45 7l1-5" stroke="var(--note-ink)" />
    </>
  ),
};
