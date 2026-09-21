"use client";

/**
 * The showreel in the hero: five agents, each doing the thing its role is
 * for, on a loop - support answering from a document, a marketer drafting
 * on a schedule, a researcher citing sources, developer support reproducing
 * a bug, an assistant moving a follow-up along. Role tabs with a progress
 * bar make it read as a demo, and a caption says what is happening.
 *
 * Built from the components the app renders, so when those change, this
 * changes with them. The server renders the first scene finished, which is
 * also what a visitor with JavaScript off, or reduced motion on, sees.
 * Timing is plain timers and CSS transitions; nothing here waits for Motion.
 */
import * as React from "react";
import {
  Bug,
  Calendar,
  Check,
  Code,
  FileSearch,
  Globe,
  Headset,
  Mail,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BEAT_MS = 1500;
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
  role: string;
  agent: string;
  seed: string;
  icon: React.ComponentType<{ className?: string }>;
  frame: string;
  captions: [string, string, string, string];
  render: (beat: number) => React.ReactNode;
}

export const SCENES: readonly Scene[] = [
  {
    id: "support",
    role: "Support",
    agent: "Mia",
    seed: "mia",
    icon: Headset,
    frame: "Client chat · Mia",
    captions: [
      "A client asks about a broken drill",
      "Mia searches the returns policy you uploaded",
      "She answers from it, in your voice",
      "Answered from one source, nothing invented",
    ],
    render: (beat) => <SupportScene beat={beat} />,
  },
  {
    id: "marketer",
    role: "Marketer",
    agent: "Nova",
    seed: "nova",
    icon: Megaphone,
    frame: "Work · Nova · scheduled run",
    captions: [
      "Monday, 09:00: Nova's scheduled run starts",
      "She reads what three competitors announced this week",
      "She drafts the post in your voice",
      "Queued for your approval - nothing was published",
    ],
    render: (beat) => <MarketerScene beat={beat} />,
  },
  {
    id: "researcher",
    role: "Researcher",
    agent: "Sol",
    seed: "sol",
    icon: Search,
    frame: "Work · Sol · weekly brief",
    captions: [
      "A standing question, every Friday",
      "Sol searches the web and keeps the sources",
      "He writes the brief with numbered citations",
      "Emailed to you - every claim has a source you can open",
    ],
    render: (beat) => <ResearcherScene beat={beat} />,
  },
  {
    id: "dev-support",
    role: "Dev support",
    agent: "Ada",
    seed: "ada",
    icon: Code,
    frame: "Client chat · Ada",
    captions: [
      "A developer pastes an error from your API",
      "Ada finds the cause in your docs and explains the fix",
      "She reproduces it with their steps",
      "Logged for engineering with steps to reproduce",
    ],
    render: (beat) => <DevScene beat={beat} />,
  },
  {
    id: "assistant",
    role: "Assistant",
    agent: "Kai",
    seed: "kai",
    icon: Calendar,
    frame: "Work · Kai · follow-ups",
    captions: [
      "A follow-up that would otherwise slip",
      "Kai drafts the email with the numbers from your notes",
      "He schedules the next step himself",
      "Waiting for your approval before it sends",
    ],
    render: (beat) => <AssistantScene beat={beat} />,
  },
];

export function HeroStage({ className }: { className?: string }) {
  const still = useReducedMotionPref();
  // The server renders the first scene finished. On mount the loop starts
  // from its first beat, so the visitor sees it build.
  const [pos, setPos] = React.useState<{ scene: number; beat: number } | null>(null);

  React.useEffect(() => {
    if (still) return;
    const id = window.setTimeout(
      () =>
        setPos((current) => {
          if (!current) return { scene: 0, beat: 0 };
          if (current.beat < BEATS - 1) return { scene: current.scene, beat: current.beat + 1 };
          return { scene: (current.scene + 1) % SCENES.length, beat: 0 };
        }),
      pos === null ? 400 : BEAT_MS,
    );
    return () => window.clearTimeout(id);
  }, [pos, still]);

  const scene = pos?.scene ?? 0;
  const beat = still ? BEATS - 1 : (pos?.beat ?? BEATS - 1);
  const current = SCENES[scene]!;
  const running = pos !== null && !still;

  return (
    <div className={cn("window overflow-hidden", className)}>
      {/* Role tabs: which agent is on, and how far through its scene. */}
      <div
        role="tablist"
        aria-label="Agents in the demo"
        className="flex gap-1 overflow-x-auto border-b border-line bg-surface-2/60 p-1.5"
      >
        {SCENES.map((entry, index) => {
          const Icon = entry.icon;
          const active = index === scene;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPos({ scene: index, beat: 0 })}
              className={cn(
                "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-md px-2.5 py-2 text-xs font-medium transition-colors sm:text-sm",
                active ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:bg-surface/70 hover:text-ink",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{entry.role}</span>
              {active && running ? (
                <span
                  key={scene}
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent"
                  style={{ animation: `reel-progress ${(BEAT_MS * BEATS) / 1000}s linear forwards` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs">
        <AgentAvatar name={current.agent} seed={current.seed} size="sm" />
        <span className="hidden shrink-0 font-mono uppercase tracking-wider text-ink-subtle sm:inline">{current.frame}</span>
        <span
          key={`${scene}-${beat}`}
          className="ml-auto truncate text-right text-ink-muted animate-in fade-in duration-500"
          aria-live="polite"
        >
          {current.captions[beat]}
        </span>
      </div>

      <div className="min-h-[21rem] bg-paper p-4 text-ink sm:p-5">{current.render(beat)}</div>
    </div>
  );
}

/** A product window at rest, for the frames under the feature headings. */
export function Frame({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("window overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-ink-subtle">{title}</span>
      </div>
      <div className="min-h-[15rem] bg-paper p-4 text-ink sm:p-5">{children}</div>
    </div>
  );
}

/* --- Shared pieces --------------------------------------------------------- */

function Appear({ when, children, className }: { when: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        when ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        className,
      )}
      aria-hidden={!when || undefined}
    >
      {children}
    </div>
  );
}

function ClientBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-panel rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-accent-fg">
        {children}
      </p>
    </div>
  );
}

function AgentBubble({ name, seed, children }: { name: string; seed: string; children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <AgentAvatar name={name} seed={seed} size="sm" />
      <div className="max-w-[88%] space-y-2 rounded-panel rounded-tl-md border border-line bg-surface px-3.5 py-2.5">
        {children}
      </div>
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
          done ? "border-positive bg-positive text-white" : active ? "border-accent" : "border-line-strong/50",
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
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar name={name} seed={seed} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink">{title}</p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">{meta}</p>
      </div>
    </div>
  );
}

function ApprovalActions({ what }: { what: string }) {
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

/* --- Scenes ------------------------------------------------------------------ */

const SUPPORT_REPLY =
  "Power tools carry a 24-month warranty, so this is a warranty claim rather than a return. Reply to your order email with the order number and we'll arrange a replacement.";

export function SupportScene({ beat }: { beat: number }) {
  const shown = beat < 2 ? 0 : beat === 2 ? Math.round(SUPPORT_REPLY.length * 0.5) : SUPPORT_REPLY.length;
  return (
    <div className="space-y-3">
      <ClientBubble>I ordered a drill two weeks ago and it stopped working. Can I return it?</ClientBubble>
      <Appear when={beat >= 1}>
        <AgentBubble name="Mia" seed="mia">
          <ToolChip icon={FileSearch}>Searched returns-policy.pdf</ToolChip>
          {beat >= 2 ? (
            <p className={cn("text-sm leading-relaxed text-ink", beat === 2 && "stream-caret")}>
              {SUPPORT_REPLY.slice(0, shown)}
            </p>
          ) : (
            <p className="text-sm text-ink-subtle">Reading the policy…</p>
          )}
        </AgentBubble>
      </Appear>
      <Appear when={beat >= 3} className="pl-9">
        <Badge tone="positive">
          <Check aria-hidden />1 source cited · nothing invented
        </Badge>
      </Appear>
    </div>
  );
}

export function MarketerScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Nova"
        seed="nova"
        title="Weekly post"
        meta="Every Monday 09:00 · LinkedIn · draft-only"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <ol className="space-y-2 rounded-lg border border-line bg-surface p-3.5">
        <Step done={beat >= 1} active={beat === 0}>
          Read the project context and this month&apos;s push
        </Step>
        <Step done={beat >= 2} active={beat === 1}>
          Researched what 3 competitors announced this week
          {beat >= 2 ? <span className="ml-1 text-xs text-ink-subtle">· 3 sources</span> : null}
        </Step>
        <Step done={beat >= 3} active={beat === 2}>
          Drafted the post in your voice
        </Step>
        <Step done={false} active={beat >= 3}>
          Publish - waiting for your approval
        </Step>
      </ol>
      <Appear when={beat >= 3}>
        <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Draft · LinkedIn</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            Every tool we sell now carries a lifetime warranty. Not 24 months. Lifetime. Because a drill that
            quits in year three was never really yours.
          </p>
          <ApprovalActions what="publish" />
        </div>
      </Appear>
    </div>
  );
}

const SOURCES = [
  { n: 1, title: "Northwind Tools launches the Pro line", host: "northwindtools.example" },
  { n: 2, title: "Fabrikam moves to a 36-month warranty", host: "fabrikam.example/news" },
  { n: 3, title: "Contoso Hardware Q3 update", host: "contoso.example/blog" },
];

function Cite({ n }: { n: number }) {
  return (
    <sup className="mx-0.5 rounded-sm bg-accent-soft px-1 font-mono text-[0.7em] text-accent-soft-fg">{n}</sup>
  );
}

export function ResearcherScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Sol"
        seed="sol"
        title="Competitor brief"
        meta="Every Friday 16:00 · emailed to you"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <p className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink">
        <span className="text-ink-subtle">Objective · </span>What did our three main competitors announce this
        week?
      </p>
      <Appear when={beat >= 1}>
        <ToolChip icon={Globe}>web_research · 3 pages read</ToolChip>
        <ol className="mt-2 space-y-1.5">
          {SOURCES.map((source) => (
            <li key={source.n} className="flex items-center gap-2.5 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-accent-soft font-mono text-xs text-accent-soft-fg">
                {source.n}
              </span>
              <span className="truncate text-ink">{source.title}</span>
              <span className="ml-auto hidden shrink-0 font-mono text-xs text-ink-subtle sm:inline">{source.host}</span>
            </li>
          ))}
        </ol>
      </Appear>
      <Appear when={beat >= 2}>
        <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink">
          Two of three moved on warranty this week: Fabrikam went to 36 months <Cite n={2} /> and Northwind
          bundled lifetime cover with its Pro line <Cite n={1} />. Contoso said nothing on warranty{" "}
          <Cite n={3} />. Our lifetime offer is now table stakes, not a differentiator.
        </div>
      </Appear>
      <Appear when={beat >= 3} className="flex flex-wrap items-center gap-2">
        <ToolChip icon={Mail}>send_email · to you</ToolChip>
        <Badge tone="positive">
          <Check aria-hidden />3 sources cited
        </Badge>
      </Appear>
    </div>
  );
}

export function DevScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-3">
      <ClientBubble>
        Calling <code className="font-mono text-xs">POST /v1/agents</code> throws{" "}
        <code className="font-mono text-xs">TypeError: cannot read &apos;id&apos; of undefined</code>. Worked
        yesterday.
      </ClientBubble>
      <Appear when={beat >= 1}>
        <AgentBubble name="Ada" seed="ada">
          <ToolChip icon={FileSearch}>Searched api-reference.md</ToolChip>
          <p className="text-sm leading-relaxed text-ink">
            That happens when <code className="font-mono text-xs">project</code> is missing from the body - since
            yesterday&apos;s release it is required. Add it and the call goes through:
          </p>
          <pre className="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink">
            {'{ "name": "Iris", "project": "acme-support", ... }'}
          </pre>
        </AgentBubble>
      </Appear>
      <Appear when={beat >= 2} className="pl-9">
        <ToolChip icon={Bug}>Reproduced with your steps · Chrome 129, Node 22</ToolChip>
      </Appear>
      <Appear when={beat >= 3} className="pl-9">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm">
          <StatusBadge status="open" />
          <span className="font-medium text-ink">Issue logged for engineering</span>
          <span className="text-ink-muted">· POST /v1/agents without project · steps 1-3 · high</span>
        </div>
      </Appear>
    </div>
  );
}

export function AssistantScene({ beat }: { beat: number }) {
  return (
    <div className="space-y-4">
      <RunHeader
        name="Kai"
        seed="kai"
        title="Follow up with Dana about the 40-seat quote"
        meta="From your notes · Thursday 10:00"
        status={beat >= 3 ? "needs_approval" : "in_progress"}
      />
      <Appear when={beat >= 1}>
        <div className="rounded-lg border border-line bg-surface px-3.5 py-3 text-sm">
          <p className="text-ink-muted">
            <span className="text-ink-subtle">To</span> dana@northwind.example ·{" "}
            <span className="text-ink-subtle">Subject</span> Re: pricing for 40 seats
          </p>
          <p className="mt-2 leading-relaxed text-ink">
            Thanks for the detail on the rollout. For 40 seats the Growth plan fits: every role, unlimited
            teammates, and a 2,000-run budget. The one-page summary you asked for is attached - happy to walk
            through it Thursday.
          </p>
        </div>
      </Appear>
      <Appear when={beat >= 2}>
        <ToolChip icon={Calendar}>schedule_followup · Thursday 10:00 · &ldquo;Did Dana reply?&rdquo;</ToolChip>
      </Appear>
      <Appear when={beat >= 3}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
          <StatusBadge status="needs_approval" />
          <span className="text-sm text-ink">Nothing sends until you say so.</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm">
              <Check aria-hidden />
              Approve and send
            </Button>
            <Button size="sm" variant="ghost">
              Edit
            </Button>
          </span>
        </div>
      </Appear>
    </div>
  );
}

/** The approvals inbox row, for the frame under "you approve anything that leaves". */
export function ApprovalScene({ beat }: { beat: number }) {
  const done = beat >= 3;
  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <RunHeader
        name="Nova"
        seed="nova"
        title="Nova wants to publish a post"
        meta="LinkedIn · scheduled run · Monday 09:00"
        status={done ? "sent" : "needs_approval"}
      />
      <blockquote className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink">
        Every tool we sell now carries a lifetime warranty. Not 24 months. Lifetime. Because a drill that quits
        in year three was never really yours.
      </blockquote>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={done} className={cn(done && "bg-positive text-white disabled:opacity-100")}>
          {done ? (
            <>
              <Check aria-hidden />
              Published
            </>
          ) : (
            <>
              <Sparkles aria-hidden />
              Approve
            </>
          )}
        </Button>
        <Button size="sm" variant="ghost" disabled={done}>
          Reject
        </Button>
        <span
          className={cn(
            "ml-auto text-xs text-ink-subtle transition-opacity duration-500",
            done ? "opacity-100" : "opacity-0",
          )}
        >
          Logged in the audit trail
        </span>
      </div>
    </div>
  );
}
