"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A hero note gives a small wiggle when the demo beside it reaches that
 * agent's "waiting for your yes" - Nova's note as her post queues, Kai's as
 * his email does - so the note and the work it is about read as one thing.
 * Listens for the event HeroStage sends; no motion under reduced motion.
 */
export function NoteNudge({ agent, className, children }: { agent: string; className?: string; children: React.ReactNode }) {
  const [nudging, setNudging] = React.useState(false);
  React.useEffect(() => {
    const onWaiting = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== agent) return;
      setNudging(false);
      requestAnimationFrame(() => setNudging(true));
    };
    window.addEventListener("desker:waiting", onWaiting);
    return () => window.removeEventListener("desker:waiting", onWaiting);
  }, [agent]);
  return (
    <div className={cn(nudging && "note-nudge", className)} onAnimationEnd={() => setNudging(false)}>
      {children}
    </div>
  );
}
