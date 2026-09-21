"use client";

/**
 * The thing that moves in the hero: the product, doing three recognisable
 * things on a loop - an agent joining the roster, a client message being
 * answered, a draft being approved. Built from the same components the app
 * renders, so when those change, this changes with them.
 *
 * The server renders the first scene in its finished state, which is also
 * what a visitor with JavaScript off, or reduced motion on, sees. Timing is
 * plain timers and CSS transitions; nothing here waits for Motion.
 */
import * as React from "react";
import { Check, FileSearch, Sparkles } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEP_MS = 1400;
const STEPS = 9; // three scenes, three beats each

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

const ROSTER = [
  { name: "Mia", job: "Customer Support Lead", seed: "mia" },
  { name: "Sol", job: "Research Analyst", seed: "sol" },
];

export function HeroStage({ className }: { className?: string }) {
  // Static until mounted: the SSR'd frame is scene 0 at its final beat. The
  // first tick, not the mount, starts the loop, so hydration paints exactly
  // what the server sent.
  const still = useReducedMotionPref();
  const [step, setStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setStep((s) => (s === null ? 0 : (s + 1) % STEPS)), STEP_MS);
    return () => window.clearInterval(id);
  }, [still]);

  if (still) return <StillStage className={className} />;

  const scene = step === null ? 0 : Math.floor(step / 3);
  const beat = step === null ? 2 : step % 3;

  return (
    <div className={cn("relative", className)} aria-hidden>
      <Frame title={["Roster", "Inbox · Conversations", "Inbox · Approvals"][scene]}>
        {scene === 0 ? <RosterScene beat={beat} /> : null}
        {scene === 1 ? <ChatScene beat={beat} /> : null}
        {scene === 2 ? <ApprovalScene beat={beat} /> : null}
      </Frame>
      <ol className="mt-4 flex justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className={cn(
              "h-1 w-6 rounded-full transition-colors duration-500",
              i === scene ? "bg-[var(--glow-text-a)]" : "bg-[var(--stage-line)]",
            )}
          />
        ))}
      </ol>
    </div>
  );
}

/** A product window: the app's surface tokens on the dark stage. */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-[var(--stage-line)] bg-[var(--stage-surface)] shadow-md">
      <div className="flex items-center gap-2 border-b border-[var(--stage-line)] px-4 py-2.5">
        <span className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-[var(--stage-line)]" />
          <i className="size-2.5 rounded-full bg-[var(--stage-line)]" />
          <i className="size-2.5 rounded-full bg-[var(--stage-line)]" />
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-[var(--stage-muted)]">{title}</span>
      </div>
      {/* The app's own page surface inside the window, in whichever theme the
          visitor is using, so the components render exactly as they do in the
          product. */}
      <div className="min-h-[15rem] rounded-b-panel bg-paper p-4 text-ink">
        {children}
      </div>
    </div>
  );
}

function RosterScene({ beat }: { beat: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ROSTER.map((agent) => (
        <li key={agent.name}>
          <AgentCard {...agent} status="published" />
        </li>
      ))}
      <li
        className={cn(
          "transition-all duration-500 ease-out",
          beat === 0 ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <AgentCard name="Nova" job="Content Marketer" seed="nova" status={beat === 2 ? "published" : "draft"} highlight={beat === 2} />
      </li>
    </ul>
  );
}

function AgentCard({
  name,
  job,
  seed,
  status,
  highlight,
}: {
  name: string;
  job: string;
  seed: string;
  status: "published" | "draft";
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-panel border bg-surface p-3.5 transition-[box-shadow,border-color] duration-500",
        highlight ? "border-accent-line shadow-md" : "border-line",
      )}
    >
      <AgentAvatar name={name} seed={seed} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{name}</p>
        <p className="truncate text-sm text-ink-muted">{job}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

const REPLY =
  "Power tools carry a 24-month warranty, so this is a warranty claim rather than a return. Reply to your order email with the order number and we'll arrange a replacement.";

function ChatScene({ beat }: { beat: number }) {
  const shown = beat === 0 ? 0 : beat === 1 ? Math.round(REPLY.length * 0.45) : REPLY.length;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-panel rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-accent-fg">
          I ordered a drill two weeks ago and it stopped working. Can I return it?
        </p>
      </div>
      <div
        className={cn(
          "flex items-end gap-2 transition-opacity duration-500",
          beat === 0 ? "opacity-0" : "opacity-100",
        )}
      >
        <AgentAvatar name="Mia" seed="mia" size="sm" />
        <div className="max-w-[85%] space-y-2 rounded-panel rounded-tl-md border border-line bg-surface px-3.5 py-2.5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
            <FileSearch className="size-3" aria-hidden />
            Searched returns-policy.pdf
          </p>
          <p className={cn("text-sm leading-relaxed text-ink", beat === 1 && "stream-caret")}>
            {REPLY.slice(0, shown)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ApprovalScene({ beat }: { beat: number }) {
  const done = beat === 2;
  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <AgentAvatar name="Nova" seed="nova" size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">Nova wants to publish a post</p>
            <StatusBadge status={done ? "sent" : "needs_approval"} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">LinkedIn · scheduled run · Monday 09:00</p>
        </div>
      </div>
      <blockquote className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink">
        Every tool we sell now carries a lifetime warranty. Not a 24-month one. Lifetime. Because a drill
        that quits in year three was never really yours.
      </blockquote>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" loading={beat === 1} disabled={done} className={cn(done && "bg-positive text-white disabled:opacity-100")}>
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

/** Reduced motion: all three moments at once, nothing moving. */
function StillStage({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      <Frame title="Roster">
        <RosterScene beat={2} />
      </Frame>
      <Frame title="Inbox · Approvals">
        <ApprovalScene beat={2} />
      </Frame>
    </div>
  );
}
