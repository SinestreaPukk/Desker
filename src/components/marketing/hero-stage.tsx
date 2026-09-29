"use client";

/**
 * The hero's demo: a work desk. Six of the staff sit in a rail on the left -
 * four at a business, two in one person's private space - and the one on duty
 * does a real piece of work on the right: a researcher's brief with its
 * sources, a marketer's post, a money manager's statement added up, a sales
 * rep's lead list, a support desk's overnight inbox, a week planned around a
 * birthday. Real output, not a
 * chat. Each step ticks as it happens; anything that would leave the
 * building ends waiting for your yes.
 *
 * Built from the components the app renders (avatars, badges, buttons), so
 * when those change this changes with them. The server renders the first
 * scene finished, which is also what a visitor with JavaScript off, or
 * reduced motion on, sees; the loop then carries on from the second scene,
 * so nothing on screen empties as the page loads. Plain timers and CSS transitions; no Motion.
 *
 * The visitor can always stop it: the pause button, or picking an agent,
 * which shows that scene finished and holds it.
 */
import * as React from "react";
import { Check, FileSearch, Globe, Lock, Mail, Pause, Play } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BEAT_MS = 1900;
const BEATS = 4;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** The OS preference, live; false on the server. */
function useReducedMotionPref() {
  return React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

interface Scene {
  id: string;
  /** Whose desk it is: a business, or one person's private space. */
  place: string;
  agent: string;
  seed: string;
  role: string;
  /** What the rail says once the scene is done. */
  result: string;
  /** Needs the owner when finished: the rail marks it. */
  waits: boolean;
  /** One line per beat, for the caption in the title bar. */
  captions: [string, string, string, string];
  render: (beat: number) => React.ReactNode;
}

const SCENES: readonly Scene[] = [
  {
    id: "research",
    place: "ABC Inc. · Work",
    agent: "Sol",
    seed: "sol",
    role: "Researcher",
    result: "Brief sent",
    waits: false,
    captions: [
      "Friday 16:00 - Sol's weekly brief starts",
      "Reading three competitors' sites and news",
      "Comparing warranty terms, with sources",
      "Brief emailed to you",
    ],
    render: (beat) => <ResearchScene beat={beat} />,
  },
  {
    id: "marketing",
    place: "ABC Inc. · Work",
    agent: "Nova",
    seed: "nova",
    role: "Marketer",
    result: "Needs your yes",
    waits: true,
    captions: [
      "Monday 08:40 - Nova picks up Sol's brief",
      "Making the post's graphic",
      "Writing the caption in your voice",
      "Scheduled for 09:00, waiting for your yes",
    ],
    render: (beat) => <MarketingScene beat={beat} />,
  },
  {
    id: "money",
    place: "Maya · Personal",
    agent: "Penny",
    seed: "penny",
    role: "Money",
    result: "Check-in sent",
    waits: false,
    captions: [
      "Monday 08:00 - Penny opens Maya's statement",
      "Adding up 46 transactions, card numbers masked",
      "Sorting spending into categories",
      "Check-in sent: one subscription to cancel",
    ],
    render: (beat) => <MoneyScene beat={beat} />,
  },
  {
    id: "sales",
    place: "ABC Inc. · Work",
    agent: "Leo",
    seed: "leo-leads",
    role: "Sales rep",
    result: "5 leads found",
    waits: true,
    captions: [
      "Tuesday 09:00 - Leo looks for new leads",
      "Scoring builders against your ideal customer",
      "Five leads, each with a reason",
      "Five intro emails drafted for your yes",
    ],
    render: (beat) => <SalesScene beat={beat} />,
  },
  {
    id: "support",
    place: "ABC Inc. · Work",
    agent: "Mia",
    seed: "mia",
    role: "Support",
    result: "1 for you",
    waits: true,
    captions: [
      "Overnight - clients write in",
      "Answering from your policies",
      "Handing a refund request to you",
      "11 answered, 1 waiting for you",
    ],
    render: (beat) => <SupportScene beat={beat} />,
  },
  {
    id: "life",
    place: "Maya · Personal",
    agent: "Juno",
    seed: "juno",
    role: "Life admin",
    result: "Needs your yes",
    waits: true,
    captions: [
      "Sunday 18:00 - Juno plans Maya's week",
      "Reading the calendar: one clash on Wednesday",
      "Spotted Sam's birthday on Thursday",
      "Gift time proposed, waiting for your yes",
    ],
    render: (beat) => <LifeScene beat={beat} />,
  },
];

/** What the reel shows where a scene asks for a decision. */
function waitingNote() {
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
      <span className="size-1.5 rounded-full bg-warning" aria-hidden />
      Waiting for your yes
    </span>
  );
}

export function HeroStage({ className, ...props }: React.ComponentProps<"div">) {
  const still = useReducedMotionPref();
  // The server renders the first scene finished. On mount the loop starts
  // from its first beat, so the visitor sees it build.
  const [pos, setPos] = React.useState<{ scene: number; beat: number } | null>(null);
  const [playing, setPlaying] = React.useState(true);
  const rail = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (still || !playing) return;
    const id = window.setTimeout(
      () =>
        setPos((current) => {
          // The first scene is already on screen, finished: move on to the
          // next rather than wiping it and building it again.
          if (!current) return { scene: 1, beat: 0 };
          if (current.beat < BEATS - 1) return { scene: current.scene, beat: current.beat + 1 };
          return { scene: (current.scene + 1) % SCENES.length, beat: 0 };
        }),
      pos === null ? BEAT_MS * 2 : BEAT_MS,
    );
    return () => window.clearTimeout(id);
  }, [pos, still, playing]);

  const scene = pos?.scene ?? 0;
  const beat = still ? BEATS - 1 : (pos?.beat ?? BEATS - 1);
  const current = SCENES[scene]!;
  const running = pos !== null && !still && playing;

  // When a scene that ends waiting on the owner gets there, the hero note
  // for that agent (if there is one) nudges (note-nudge.tsx).
  React.useEffect(() => {
    if (running && beat === BEATS - 1 && current.waits) {
      window.dispatchEvent(new CustomEvent("desker:waiting", { detail: current.agent }));
    }
  }, [running, beat, current]);

  /** Picking an agent shows their work finished and holds it there. */
  const pick = (index: number) => {
    setPlaying(false);
    setPos({ scene: index, beat: BEATS - 1 });
  };
  const onKey = (event: React.KeyboardEvent) => {
    const last = SCENES.length - 1;
    const next = ["ArrowDown", "ArrowRight"].includes(event.key);
    const prev = ["ArrowUp", "ArrowLeft"].includes(event.key);
    const to = next
      ? scene === last ? 0 : scene + 1
      : prev
        ? scene === 0 ? last : scene - 1
        : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (to === null) return;
    event.preventDefault();
    pick(to);
    (rail.current?.children[to] as HTMLElement | undefined)?.focus();
  };

  return (
    <div {...props} className={cn("window overflow-hidden", className)}>
      {/* Title bar: the workspace, what is happening now, and the pause. */}
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 py-1.5 pl-4 pr-2">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
        </span>
        <span className="hidden shrink-0 text-xs font-semibold text-ink sm:inline">{current.place}</span>
        <span
          key={`${scene}-${beat}`}
          className="ml-auto truncate text-right text-xs text-ink-muted animate-in fade-in duration-500"
          aria-live={playing ? "off" : "polite"}
        >
          {current.captions[beat]}
        </span>
        {still ? null : (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              if (!playing && beat === BEATS - 1) setPos({ scene, beat: 0 });
              setPlaying((value) => !value);
            }}
            aria-label={playing ? "Pause the demo" : "Play the demo"}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
        {/* The staff on the rail: who is on it now, and how the others' work
            ended. A real tab list: arrows move between them. */}
        <div
          ref={rail}
          role="tablist"
          aria-label="Staff in the demo"
          aria-orientation="vertical"
          onKeyDown={onKey}
          className="flex gap-1 border-b border-line bg-surface-2/40 p-1.5 sm:flex-col sm:border-b-0 sm:border-r sm:p-2"
        >
          {SCENES.map((entry, index) => {
            const active = index === scene;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`${panelId}-tab-${index}`}
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => pick(index)}
                className={cn(
                  "relative flex min-h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg px-1.5 py-1.5 text-left transition-colors sm:flex-none sm:justify-start sm:px-2",
                  active ? "bg-surface shadow-xs" : "hover:bg-surface/70",
                )}
              >
                <AgentAvatar name={entry.agent} seed={entry.seed} size="sm" />
                <span className="hidden min-w-0 sm:block">
                  <span className="block text-sm font-semibold leading-tight text-ink">{entry.agent}</span>
                  <span className="flex items-center gap-1 truncate text-xs leading-tight text-ink-muted">
                    {active && running && beat < BEATS - 1 ? (
                      <>
                        <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
                        Working
                      </>
                    ) : (
                      <>
                        {entry.waits && (index < scene || (active && beat === BEATS - 1)) ? <span className="size-1.5 rounded-full bg-warning" aria-hidden /> : null}
                        {active ? entry.result : entry.role}
                      </>
                    )}
                  </span>
                </span>
                <span className="relative text-xs font-semibold text-ink sm:hidden">
                  {entry.agent}
                  {entry.waits && index < scene ? (
                    <span className="absolute -right-2 -top-0.5 size-1.5 rounded-full bg-warning" aria-hidden />
                  ) : null}
                </span>
                {active && running ? (
                  <span
                    key={scene}
                    aria-hidden
                    className="absolute inset-x-2 bottom-0.5 h-0.5 origin-left rounded-full bg-accent"
                    style={{ animation: `reel-progress ${(BEAT_MS * BEATS) / 1000}s linear forwards` }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* The work itself: a picture, so its buttons stay out of the tab
            order. Every scene sits in the same grid cell, finished and
            invisible except the running one, so the desk is always as tall
            as its tallest scene - no layout shift as the reel moves on. */}
        <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${scene}`} className="min-w-0">
          {/* The reel plays on its own, so a decision it reaches is shown as
              what it is - waiting for you - not as a button that does nothing. */}
          <DecideContext.Provider value={waitingNote}>
          <div className="grid grid-cols-1 bg-paper p-4 text-ink sm:p-5" inert>
            {SCENES.map((entry, index) => (
              <div
                key={entry.id}
                aria-hidden={index !== scene}
                className={cn("min-w-0 self-start [grid-area:1/1]", index === scene ? "scene-in" : "invisible")}
              >
                {entry.render(index === scene ? beat : BEATS - 1)}
              </div>
            ))}
          </div>
          </DecideContext.Provider>
        </div>
      </div>
    </div>
  );
}

/* --- Shared pieces --------------------------------------------------------- */

function Appear({ when, children, className }: { when: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "transition duration-500 ease-out",
        when ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        className,
      )}
      aria-hidden={!when || undefined}
    >
      {children}
    </div>
  );
}

function ToolChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
      <Icon className="size-3" aria-hidden />
      {children}
    </p>
  );
}

/** A run's step list: each line ticks as the agent gets to it. */
function Step({ done, active, children }: { done: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 text-sm transition-colors duration-300",
        done ? "text-ink" : active ? "text-ink-muted" : "text-ink-subtle",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
          done ? "border-positive bg-positive text-positive-fg" : active ? "border-accent" : "border-line-strong/50",
        )}
      >
        {done ? (
          <Check className="size-2.5" aria-hidden />
        ) : active ? (
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

/** A host can override a waiting run's badge once the owner decides (the showcase). */
export const DecidedStatusContext = React.createContext<string | null>(null);

function RunHeader({
  name,
  seed,
  title,
  meta,
  status,
}: {
  name: string;
  seed: string;
  title: string;
  meta: string;
  status: string;
}) {
  const decided = React.useContext(DecidedStatusContext);
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar name={name} seed={seed} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink">{title}</p>
          <StatusBadge status={(status === "needs_approval" && decided) || status} />
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">{meta}</p>
      </div>
    </div>
  );
}

/**
 * Where a scene asks for a decision, a host can put a working control. The
 * landing page's reel leaves these as pictures (it is a demo that plays on
 * its own); the showcase provides live buttons through this context.
 */
export const DecideContext = React.createContext<((label: string) => React.ReactNode) | null>(null);

/** The primary decision button of a scene: a picture, or the host's live control. */
function Decide({ label }: { label: string }) {
  const live = React.useContext(DecideContext);
  if (live) return <>{live(label)}</>;
  return (
    <Button size="sm" className="ml-auto">
      <Check aria-hidden />
      {label}
    </Button>
  );
}

function ApprovalActions({ what }: { what: string }) {
  const live = React.useContext(DecideContext);
  if (live) return <div className="mt-3">{live(`Approve and ${what}`)}</div>;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm">
        <Check aria-hidden />
        Approve and {what}
      </Button>
      <Button size="sm" variant="secondary">
        Edit
      </Button>
      <Button size="sm" variant="ghost">
        Reject
      </Button>
    </div>
  );
}

/* --- The work ------------------------------------------------------------------ */

/** A run's steps, ticking as the agent gets to each. */
function Steps({ beat, steps }: { beat: number; steps: readonly string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <Step key={step} done={beat > index} active={beat === index}>
          {step}
        </Step>
      ))}
    </ol>
  );
}

const WARRANTY = [
  { name: "Tailspin Pro", months: 60, label: "Lifetime", cite: 1 },
  { name: "Fabrikam", months: 36, label: "36 mo", cite: 2 },
  { name: "Contoso", months: 24, label: "24 mo", cite: 3 },
  { name: "You", months: 24, label: "24 mo", cite: 0 },
];

function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 rounded-sm bg-accent-soft px-1 font-mono text-[0.7em] text-accent-soft-fg">{n}</sup>
  );
}

export function ResearchScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Sol"
        seed="sol"
        title="Weekly competitor brief"
        meta="Every Friday 16:00 · web research"
        status={beat >= 3 ? "done" : "in_progress"}
      />
      <Steps
        beat={beat}
        steps={["Read 14 pages from three competitors", "Compared warranty terms", "Wrote the brief, a source for every claim"]}
      />
      {/* The pages it is reading, as it reads them. */}
      <Appear when={beat === 0 || beat === 1} className={cn(beat >= 2 && "hidden")}>
        <ul className="space-y-1.5 rounded-lg border border-line bg-surface p-3 text-xs">
          {["tailspintools.example/pro-line", "fabrikam.example/news/warranty", "contoso.example/blog/q3"].map((url, index) => (
            <li key={url} className={cn("flex items-center gap-2 transition-opacity duration-500", beat * 2 + 1 >= index ? "opacity-100" : "opacity-0")}>
              <Globe className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
              <span className="truncate font-mono text-ink-muted">{url}</span>
            </li>
          ))}
        </ul>
      </Appear>
      <Appear when={beat >= 2}>
        <div className="rounded-lg border border-line bg-surface p-3.5">
          <p className="text-sm font-semibold text-ink">Two of three competitors moved on warranty</p>
          <ul className="mt-3 space-y-2">
            {WARRANTY.map((row) => (
              <li key={row.name} className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-2 text-xs">
                <span className={cn("truncate", row.cite ? "text-ink-muted" : "font-semibold text-ink")}>{row.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-700 ease-out", row.cite ? "bg-accent/45" : "bg-accent")}
                    style={{ width: beat >= 2 ? `${(row.months / 60) * 100}%` : "0%" }}
                  />
                </span>
                <span className="text-right text-ink">
                  {row.label}
                  {row.cite ? <Cite n={row.cite} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Appear>
      <Appear when={beat >= 3} className="flex flex-wrap items-center gap-2">
        <ToolChip icon={Mail}>Emailed to you</ToolChip>
        <ToolChip icon={Globe}>3 sources, each one linked</ToolChip>
      </Appear>
    </div>
  );
}

const CAPTION =
  "A drill that quits in month 23 is still ours to fix. Every power tool we sell carries a 24-month warranty, and a claim takes one email.";

export function MarketingScene({ beat }: { beat: number }) {
  const typed = beat < 2 ? 0 : beat === 2 ? Math.round(CAPTION.length * 0.55) : CAPTION.length;
  return (
    <div className="space-y-4">
      <RunHeader
        name="Nova"
        seed="nova"
        title="This week's post"
        meta="Every Monday 08:40 · from Sol's brief"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        {/* The post's graphic, made from the brief. */}
        <Appear when={beat >= 1}>
          <div className="relative flex min-h-32 flex-col justify-between gap-1 overflow-hidden rounded-md bg-note-lemon p-3 text-note-ink sm:aspect-square">
            <span className="text-xs font-semibold">ABC Inc.</span>
            <span className="font-hand text-hand-cta font-bold">24 months</span>
            <span className="text-xs font-semibold leading-tight">one email to claim</span>
            <span aria-hidden className="absolute -right-4 -top-4 size-14 rounded-full bg-note-coral" />
          </div>
        </Appear>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-muted">Website news · Monday 09:00</p>
          <p className={cn("mt-1.5 text-sm leading-relaxed text-ink", beat === 2 && "stream-caret")}>
            {typed ? CAPTION.slice(0, typed) : <span className="text-ink-subtle">Writing in your voice…</span>}
          </p>
        </div>
      </div>
      <Appear when={beat >= 3}>
        <ApprovalActions what="publish" />
      </Appear>
    </div>
  );
}

const LEADS = [
  { name: "Hale & Sons", fit: 3, why: "Two new sites this year" },
  { name: "Crane Joinery", fit: 3, why: "Buys drills each spring" },
  { name: "Ash Lane Homes", fit: 2, why: "Asked about trade prices" },
  { name: "Mercer & Co", fit: 2, why: "New depot in Leeds" },
  { name: "Bright Kitchens", fit: 2, why: "Your ideal customer" },
];

export function SalesScene({ beat }: { beat: number }) {
  const shown = beat === 0 ? 1 : beat === 1 ? 3 : 5;
  return (
    <div className="space-y-4">
      <RunHeader
        name="Leo"
        seed="leo-leads"
        title="Five new leads"
        meta="Every Tuesday 09:00 · from your CRM export"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1.4fr)] gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-ink-muted">
          <span>Company</span>
          <span>Fit</span>
          <span>Why</span>
        </div>
        <ul>
          {LEADS.map((lead, index) => (
            <li
              key={lead.name}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1.4fr)] items-center gap-2 border-b border-line/70 px-3 py-2 text-xs transition-opacity duration-500 last:border-b-0",
                index < shown ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="truncate font-medium text-ink">{lead.name}</span>
              <span className="flex gap-0.5" aria-label={`Fit ${lead.fit} of 3`}>
                {[1, 2, 3].map((dot) => (
                  <span key={dot} className={cn("size-2 rounded-full", dot <= lead.fit ? "bg-positive" : "bg-line")} />
                ))}
              </span>
              <span className="truncate text-ink-muted">{lead.why}</span>
            </li>
          ))}
        </ul>
      </div>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <Mail className="size-4 text-ink-muted" aria-hidden />
          <span className="text-sm text-ink">5 intro emails drafted</span>
          <Decide label="Approve and send" />
        </div>
      </Appear>
    </div>
  );
}

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function AssistantScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Kai"
        seed="kai"
        title="Thursday's meeting"
        meta="From your meeting notes · Dana, Litware"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      {/* Next week, with the call Kai proposes. */}
      <div className="grid grid-cols-5 gap-1.5">
        {WEEK.map((day) => (
          <div key={day} className="rounded-md border border-line bg-surface p-1.5">
            <p className="text-center text-xs font-semibold text-ink-muted">{day}</p>
            <div className="mt-1.5 h-12 space-y-1">
              {day === "Mon" ? <span className="block h-2.5 rounded-sm bg-surface-3" /> : null}
              {day === "Wed" ? <span className="block h-2.5 rounded-sm bg-surface-3" /> : null}
              {day === "Thu" ? (
                <span
                  className={cn(
                    "block rounded-sm bg-accent-soft px-1 py-0.5 text-xs font-semibold leading-tight text-accent-soft-fg transition-opacity duration-500",
                    beat >= 1 ? "opacity-100" : "opacity-0",
                  )}
                >
                  10:00 Dana
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Appear when={beat >= 2}>
        <ul className="space-y-1 text-sm text-ink">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Send the 40-drill quote</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Confirm delivery to the new site</li>
        </ul>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <span className="text-sm text-ink">
            <span className="font-medium">Re: quote for 40 drills</span>
            <span className="text-ink-muted"> · to Dana</span>
          </span>
          <Decide label="Approve and send" />
        </div>
      </Appear>
    </div>
  );
}

const TICKETS = [
  { topic: "Drill stopped working", how: "Answered · returns-policy.pdf", status: "resolved" },
  { topic: "Delivery to Hull", how: "Answered · delivery-faq.md", status: "resolved" },
  { topic: "Refund, order #4471", how: "Money is your call · handed to you", status: "escalated" },
];

export function SupportScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Mia"
        seed="mia"
        title="Overnight client inbox"
        meta="22:00 to 07:00 · chat and email"
        status={beat >= 3 ? "escalated" : "in_progress"}
      />
      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        {TICKETS.map((ticket, index) => (
          <li
            key={ticket.topic}
            className={cn(
              "flex items-center gap-3 border-b border-line/70 px-3.5 py-2.5 transition-opacity duration-500 last:border-b-0",
              beat >= index ? "opacity-100" : "opacity-0",
            )}
          >
            <FileSearch className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{ticket.topic}</span>
              <span className="block truncate text-xs text-ink-muted">{ticket.how}</span>
            </span>
            <StatusBadge status={ticket.status} />
          </li>
        ))}
      </ul>
      <Appear when={beat >= 3}>
        <p className="text-sm text-ink">
          <span className="font-semibold">11 answered</span> from your documents,{" "}
          <span className="font-semibold">1 waiting for you</span> in Needs you.
        </p>
      </Appear>
    </div>
  );
}

/* --- More of the staff, for the showcase -------------------------------------- */

const ONBOARDING = [
  { item: "Contract signed", by: "Harbour Café" },
  { item: "Account set up", by: "Ivy" },
  { item: "Delivery address", by: "Harbour Café" },
  { item: "VAT number", by: "Harbour Café" },
  { item: "First order", by: "Harbour Café" },
];

/** Client onboarding: the checklist filling up, then the welcome email. */
export function OnboardingScene({ beat }: { beat: number }) {
  const done = beat === 0 ? 1 : 2;
  return (
    <div className="space-y-4">
      <RunHeader
        name="Ivy"
        seed="ivy"
        title="Welcome Harbour Café"
        meta="When a new client signs · onboarding checklist"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <div className="rounded-lg border border-line bg-surface p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">Onboarding</span>
          <span className="text-ink-muted tabular-nums">{done} of {ONBOARDING.length}</span>
        </div>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
          <span
            className="block h-full rounded-full bg-positive transition-[width] duration-700 ease-out"
            style={{ width: `${(done / ONBOARDING.length) * 100}%` }}
          />
        </span>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {ONBOARDING.map((step, index) => {
            const ok = index < done;
            const flagged = !ok && beat >= 1;
            return (
              <li key={step.item} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    ok ? "border-positive bg-positive text-positive-fg" : flagged ? "border-warning" : "border-line-strong/50",
                  )}
                >
                  {ok ? <Check className="size-2.5" aria-hidden /> : null}
                </span>
                <span className={ok ? "text-ink" : "text-ink-muted"}>{step.item}</span>
                {flagged ? <span className="text-xs text-warning">from them</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
      <Appear when={beat >= 2}>
        <div className="rounded-lg border border-line bg-surface px-3.5 py-3 text-sm">
          <p className="text-ink-muted">
            <span className="text-ink-subtle">To</span> hello@harbourcafe.example ·{" "}
            <span className="text-ink-subtle">Subject</span> Welcome to ABC Inc.
          </p>
          <p className="mt-2 leading-relaxed text-ink">
            Here is what happens this week. We still need your delivery address, VAT number and first order. Shall we
            do a kickoff call on Tuesday at 10:00?
          </p>
        </div>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <Mail className="size-4 text-ink-muted" aria-hidden />
          <span className="text-sm text-ink">Welcome email drafted</span>
          <Decide label="Approve and send" />
        </div>
      </Appear>
    </div>
  );
}

/** Developer support: the failing request, the fix, the issue for engineering. */
export function DevScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Ada"
        seed="ada"
        title="POST /v1/orders is failing"
        meta="When a developer writes in · API reference"
        status={beat >= 3 ? "open" : "in_progress"}
      />
      {/* The request the developer sent, and the answer they got. */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface font-mono text-xs leading-relaxed">
        <div className="border-b border-line bg-surface-2/60 px-3 py-1.5 text-ink-muted">POST /v1/orders</div>
        <pre className="whitespace-pre-wrap px-3 py-2 text-ink">
          {"{\n  \"sku\": \"DRL-18V\",\n  \"qty\": 40"}
          {beat >= 1 ? (
            <span className="block rounded-sm bg-positive-soft text-positive transition-colors">{'+ "store_id": "leeds-01"'}</span>
          ) : null}
          {"}"}
        </pre>
        <div
          className={cn(
            "border-t border-line px-3 py-1.5 transition-colors duration-500",
            beat >= 1 ? "bg-positive-soft text-positive" : "bg-danger-soft text-danger",
          )}
        >
          {beat >= 1 ? "201 Created · order 88412" : "500 TypeError: cannot read 'id' of undefined"}
        </div>
      </div>
      <Appear when={beat >= 2}>
        <p className="text-sm leading-relaxed text-ink">
          <span className="font-semibold">Found in your API reference:</span> since yesterday&apos;s release{" "}
          <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">store_id</code> is required. Ada replied with
          the fix above.
        </p>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status="open" />
            <span className="font-semibold text-ink">Logged for engineering</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">1. Place an order without store_id · 2. API returns 500 · since release 4.2</p>
        </div>
      </Appear>
    </div>
  );
}

const FIRST_WEEK = [
  { day: "Mon", plan: "Welcome, laptop, handbook" },
  { day: "Tue", plan: "A day at the Leeds branch" },
  { day: "Wed", plan: "Stock system training" },
  { day: "Thu", plan: "Shadow the trade desk" },
  { day: "Fri", plan: "Check-in with you" },
];

/** People ops: a new hire's first week, laid out day by day. */
export function PeopleScene({ beat }: { beat: number }) {
  const shown = beat === 0 ? 2 : beat === 1 ? 4 : 5;
  return (
    <div className="space-y-4">
      <RunHeader
        name="Rae"
        seed="rae"
        title="Priya starts on Monday"
        meta="When a new hire is added · from your handbook"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {FIRST_WEEK.map((day, index) => (
          <li
            key={day.day}
            className={cn(
              "rounded-md border border-line bg-surface p-2 transition-opacity duration-500",
              index < shown ? "opacity-100" : "opacity-0",
            )}
          >
            <p className="text-xs font-semibold text-ink">{day.day}</p>
            <p className="mt-1 text-xs leading-snug text-ink-muted">{day.plan}</p>
          </li>
        ))}
      </ol>
      <Appear when={beat >= 2}>
        <ul className="space-y-1 text-sm text-ink">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Laptop request drafted for IT</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Heads-up written for the team channel</li>
        </ul>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <Mail className="size-4 text-ink-muted" aria-hidden />
          <span className="text-sm text-ink">Welcome email to Priya</span>
          <Decide label="Approve and send" />
        </div>
      </Appear>
    </div>
  );
}

/* --- The personal space ------------------------------------------------------ */

const SPENDING = [
  { category: "Rent", amount: 18000 },
  { category: "Eating out", amount: 4900 },
  { category: "Groceries", amount: 3250 },
  { category: "Transport", amount: 1420 },
  { category: "Subscriptions", amount: 1127 },
];

export function MoneyScene({ beat }: { beat: number }) {
  const top = SPENDING[0]!.amount;
  return (
    <div className="space-y-4">
      <RunHeader
        name="Penny"
        seed="penny"
        title="Your money this week"
        meta="Every Monday 08:00 · march-statement.csv"
        status={beat >= 3 ? "done" : "in_progress"}
      />
      <Steps
        beat={beat}
        steps={["Added up 46 transactions, to the cent", "Sorted them into categories", "Found 3 subscriptions, one unused"]}
      />
      <Appear when={beat >= 2}>
        <div className="rounded-lg border border-line bg-surface p-3.5">
          <p className="text-sm font-semibold text-ink">฿28,697 out · ฿2,100 under budget</p>
          <ul className="mt-3 space-y-2">
            {SPENDING.map((row) => (
              <li key={row.category} className="grid grid-cols-[6rem_1fr_4.5rem] items-center gap-2 text-xs">
                <span className="truncate text-ink-muted">{row.category}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                    style={{ width: beat >= 2 ? `${(row.amount / top) * 100}%` : "0%" }}
                  />
                </span>
                <span className="text-right tabular-nums text-ink">฿{row.amount.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        </div>
      </Appear>
      <Appear when={beat >= 3} className="flex flex-wrap items-center gap-2">
        <ToolChip icon={Mail}>Disney+ ฿289 a month, unused since June</ToolChip>
        <ToolChip icon={Lock}>Card numbers masked</ToolChip>
      </Appear>
    </div>
  );
}

const MAYA_WEEK: Record<string, string | null> = { Mon: "Gym", Tue: null, Wed: "Dentist", Thu: "Sam's birthday", Fri: "Drinks" };

export function LifeScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Juno"
        seed="juno"
        title="Plan the week ahead"
        meta="Sunday 18:00 · your calendar"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <div className="grid grid-cols-5 gap-1.5">
        {WEEK.map((day) => {
          const event = MAYA_WEEK[day];
          const birthday = day === "Thu";
          return (
            <div key={day} className="rounded-md border border-line bg-surface p-1.5">
              <p className="text-center text-xs font-semibold text-ink-muted">{day}</p>
              <div className="mt-1.5 h-12 space-y-1">
                {event ? (
                  <span
                    className={cn(
                      "block rounded-sm px-1 py-0.5 text-xs leading-tight transition-colors duration-500",
                      birthday && beat >= 2 ? "bg-accent-soft font-semibold text-accent-soft-fg" : "bg-surface-3 text-ink-muted",
                    )}
                  >
                    {event}
                  </span>
                ) : null}
                {day === "Wed" ? (
                  <span
                    className={cn(
                      "block rounded-sm bg-accent-soft px-1 py-0.5 text-xs font-semibold leading-tight text-accent-soft-fg transition-opacity duration-500",
                      beat >= 3 ? "opacity-100" : "opacity-0",
                    )}
                  >
                    18:00 Gift
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <Appear when={beat >= 1}>
        <ul className="space-y-1 text-sm text-ink">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Dentist moved clear of your 3pm call</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />Reply to your landlord drafted</li>
        </ul>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <span className="text-sm text-ink">
            <span className="font-medium">Gift shopping for Sam</span>
            <span className="text-ink-muted"> · Wed 18:00</span>
          </span>
          <Decide label="Approve and add" />
        </div>
      </Appear>
    </div>
  );
}

/** One run, from a role's own record: for roles without a scene of their own. */
export interface WorkRecord {
  trigger: string;
  task: string;
  steps: readonly string[];
  output: { label: string; title: string; lines: readonly string[] };
  status: string;
}

export function WorkScene({ beat, work, agent, seed }: { beat: number; work: WorkRecord; agent: string; seed: string }) {
  const last = work.steps.length;
  return (
    <div className="space-y-4">
      <RunHeader
        name={agent}
        seed={seed}
        title={work.task}
        meta={work.trigger}
        status={beat >= 3 ? work.status : "in_progress"}
      />
      <Steps beat={Math.min(beat, last)} steps={work.steps} />
      <Appear when={beat >= 3}>
        <div className="rounded-lg border border-line bg-surface p-3.5">
          <p className="meta">{work.output.label}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{work.output.title}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {work.output.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {work.status === "needs_approval" ? (
            <div className="mt-3 flex">
              <Decide label="Approve" />
            </div>
          ) : null}
        </div>
      </Appear>
    </div>
  );
}

/** Each role's own scene, for the showcase. */
export const ROLE_SCENES: Record<string, (props: { beat: number }) => React.ReactNode> = {
  "customer-support": SupportScene,
  "client-onboarding": OnboardingScene,
  researcher: ResearchScene,
  marketer: MarketingScene,
  secretary: AssistantScene,
  "dev-support": DevScene,
  "sales-development": SalesScene,
  "people-ops": PeopleScene,
  "money-manager": MoneyScene,
  "personal-assistant": LifeScene,
};
export const SCENE_BEATS = BEATS;
