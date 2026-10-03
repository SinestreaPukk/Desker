import { cn } from "@/lib/utils";

/**
 * The notes your staff leave on your desk: taped around the hero's product
 * window, each from one of the agents in the reel, each waiting on you or
 * telling you what got done. A picture of the idea, not a control, so it is
 * hidden from assistive tech; the reel beside it carries the same story.
 */

type Tone = "lemon" | "sky" | "mint" | "coral" | "lilac";

const FILL: Record<Tone, string> = {
  lemon: "bg-note-lemon",
  sky: "bg-note-sky",
  mint: "bg-note-mint",
  coral: "bg-note-coral",
  lilac: "bg-note-lilac",
};

export function StickyNote({
  tone,
  tilt,
  order = 0,
  settle = true,
  soft = false,
  className,
  children,
}: {
  tone: Tone;
  /** Degrees; a few either way reads as placed by hand. */
  tilt: number;
  /** Settling order on load. */
  order?: number;
  /** Settle in on page load. Off for notes further down, which are not on screen then. */
  settle?: boolean;
  /** A paler note, for many notes together, where full colour would shout. */
  soft?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("note note-lift p-4", settle && "note-in", !soft && FILL[tone], className)}
      style={
        {
          "--tilt": `${tilt}deg`,
          "--n": order,
          ...(soft ? { background: `color-mix(in oklch, var(--note-${tone}) 50%, var(--surface))` } : {}),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * More notes on the desk, just beyond focus: large soft shapes in the note
 * colours, blurred and see-through, behind a section's content. They are
 * the page's ground in place of a pattern, so every section sits on the same
 * desk. Placed per section by a preset; gone for anyone who asks for less
 * transparency (globals.css, .soft-notes). Clip the section that holds them
 * with overflow-clip, not overflow-hidden: hidden makes it a scroll
 * container, and every scroll-driven reveal inside it then stalls halfway.
 */
type Blur = { tone: Tone; className: string; tilt: number };

const SOFT: Record<"hero" | "cta" | "band" | "header", Blur[]> = {
  hero: [
    { tone: "lemon", className: "-left-24 top-24 h-72 w-80", tilt: -10 },
    { tone: "sky", className: "-right-20 top-8 h-80 w-96", tilt: 8 },
    { tone: "lilac", className: "right-[6%] top-[34rem] h-64 w-72", tilt: -6 },
    { tone: "mint", className: "left-[4%] top-[38rem] h-64 w-72", tilt: 9 },
  ],
  cta: [
    { tone: "sky", className: "-left-16 top-10 h-72 w-80", tilt: 7 },
    { tone: "coral", className: "-right-16 bottom-6 h-72 w-80", tilt: -8 },
    { tone: "mint", className: "left-[38%] -bottom-24 h-56 w-72", tilt: 4 },
  ],
  band: [
    { tone: "lilac", className: "-right-24 top-16 h-80 w-96", tilt: 9 },
    { tone: "mint", className: "-left-24 bottom-32 h-80 w-96", tilt: -7 },
  ],
  header: [
    { tone: "lemon", className: "-left-20 top-6 h-64 w-72", tilt: -9 },
    { tone: "sky", className: "right-[4%] top-0 h-72 w-80", tilt: 8 },
  ],
};

export function SoftNotes({ preset }: { preset: keyof typeof SOFT }) {
  return (
    <div aria-hidden className="soft-notes pointer-events-none absolute inset-0">
      {SOFT[preset].map((blur, index) => (
        <span
          key={index}
          className={cn("absolute rounded-panel", FILL[blur.tone], blur.className)}
          style={{ rotate: `${blur.tilt}deg` }}
        />
      ))}
    </div>
  );
}
