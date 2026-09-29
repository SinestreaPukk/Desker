"use client";

/**
 * One role at work, in its own scene - the same scenes the landing page's
 * demo is built from, one designed for each role: the researcher's brief
 * and chart, the marketer's post, the sales rep's lead table, the
 * assistant's calendar, the support desk's inbox, the onboarding checklist,
 * the failing API request and its fix, a new hire's first week.
 *
 * It plays once, when it scrolls into view, then holds; the replay button
 * runs it again. Where the run ends waiting for you, the decision is live:
 * approve or reject, and undo (local state only; nothing is sent). The
 * server renders it finished, which is also what a visitor without
 * JavaScript or with reduced motion sees.
 */
import * as React from "react";
import { Check, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionStamp } from "@/components/ui/decision-stamp";
import { DecideContext, DecidedStatusContext, ROLE_SCENES, SCENE_BEATS } from "@/components/marketing/hero-stage";

const BEAT_MS = 1500;

export function RoleRun({ roleId, agent, place }: { roleId: string; agent: string; place: string }) {
  const Scene = ROLE_SCENES[roleId];
  const root = React.useRef<HTMLDivElement>(null);
  // null: not started, shown finished (server render, no JS, reduced motion).
  const [beat, setBeat] = React.useState<number | null>(null);
  const [decision, setDecision] = React.useState<"waiting" | "approved" | "rejected">("waiting");
  // An approved post is published; anything else approved is sent.
  const [approvedAs, setApprovedAs] = React.useState<"published" | "sent">("sent");

  const play = React.useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDecision("waiting");
    setBeat(0);
  }, []);

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          play();
          seen.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, [play]);

  React.useEffect(() => {
    if (beat === null || beat >= SCENE_BEATS - 1) return;
    const id = window.setTimeout(() => setBeat((current) => (current === null ? null : current + 1)), BEAT_MS);
    return () => window.clearTimeout(id);
  }, [beat]);

  const decide = React.useCallback(
    (label: string) =>
      decision === "waiting" ? (
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setApprovedAs(label.includes("publish") ? "published" : "sent");
              setDecision("approved");
            }}
          >
            <Check aria-hidden />
            {label}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDecision("rejected")}>
            <X aria-hidden />
            Reject
          </Button>
        </span>
      ) : (
        <span className="ml-auto flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-sm text-ink">
            {decision === "approved"
              ? "Approved. In Desker it goes out now and the audit log records it. (A demo: nothing was sent.)"
              : `Rejected. ${agent} won't send it.`}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDecision("waiting")}>
            <Undo2 aria-hidden />
            Reset demo
          </Button>
        </span>
      ),
    [decision, agent],
  );

  if (!Scene) return null;
  return (
    <div ref={root} className="window relative overflow-hidden text-left">
      {decision !== "waiting" ? (
        <DecisionStamp kind={decision === "rejected" ? "rejected" : approvedAs} className="right-6 top-14 z-10" />
      ) : null}
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 py-1.5 pl-4 pr-2">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
        </span>
        <span className="truncate text-xs font-semibold text-ink-muted">{place}</span>
        <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={play} aria-label="Play this run again">
          <RotateCcw aria-hidden />
        </Button>
      </div>
      {/* The finished scene sits invisibly in the same grid cell as the one
          playing, so the card is always its full height: replay never
          shrinks it. */}
      <div className="grid grid-cols-1 bg-paper p-4 text-ink sm:p-5">
        <div className="invisible [grid-area:1/1]" aria-hidden inert>
          <Scene beat={SCENE_BEATS - 1} />
        </div>
        <div className="min-w-0 [grid-area:1/1]">
          <DecidedStatusContext.Provider value={decision === "waiting" ? null : decision === "approved" ? approvedAs : decision}>
            <DecideContext.Provider value={decide}>
              <Scene beat={beat ?? SCENE_BEATS - 1} />
            </DecideContext.Provider>
          </DecidedStatusContext.Provider>
        </div>
      </div>
    </div>
  );
}
