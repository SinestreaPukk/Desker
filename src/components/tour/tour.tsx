"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Callouts } from "./infographic";
import { TOUR } from "./tour-content";

/** Fired to reopen the tour from anywhere (Help, the setup checklist). */
const TOUR_OPEN_EVENT = "desker:tour-open";

export function openTour() {
  window.dispatchEvent(new Event(TOUR_OPEN_EVENT));
}

// Seen once per browser: a preference of the person looking,
// like the setup checklist's, and never a reason to break the page.
const seenKey = () => "desker.tour.seen.personal";
function seen(): boolean {
  try {
    return window.localStorage.getItem(seenKey()) === "1";
  } catch {
    return true;
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(seenKey(), "1");
  } catch {
    /* a convenience, not a record */
  }
}

type Chapter = "setup" | "features";

/**
 * The welcome tour: opens by itself the first time someone arrives, then on
 * demand. First where to press to get set up, one screen at a time, each
 * with a drawing of the real screen and numbered marks; then what is
 * different about Desker, each with one thing worth trying and a link to it.
 */
export function Tour({ project }: { project: string }) {
  const { setup, features } = TOUR;
  const [open, setOpen] = React.useState(false);
  const [chapter, setChapter] = React.useState<Chapter>("setup");
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    // After the page has painted, so it opens over something recognisable.
    const timer = window.setTimeout(() => {
      if (!seen()) setOpen(true);
    }, 400);
    function reopen() {
      setChapter("setup");
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener(TOUR_OPEN_EVENT, reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(TOUR_OPEN_EVENT, reopen);
    };
  }, []);

  function close(next: boolean) {
    setOpen(next);
    if (!next) markSeen();
  }

  const items = chapter === "setup" ? setup : features;
  const last = index === items.length - 1;
  const step = chapter === "setup" ? setup[index] : null;
  const feature = chapter === "features" ? features[index] : null;

  function go(nextChapter: Chapter, nextIndex = 0) {
    setChapter(nextChapter);
    setIndex(nextIndex);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl p-0">
        <div className="border-b border-line px-6 pb-4 pt-5">
          <Tabs value={chapter} onValueChange={(next) => go(next as Chapter)}>
            <TabsList aria-label="Tour chapters">
              <TabsTrigger value="setup">Get set up</TabsTrigger>
              <TabsTrigger value="features">What&apos;s different</TabsTrigger>
            </TabsList>
          </Tabs>
          <DialogTitle className="mt-4">{step?.title ?? feature?.title}</DialogTitle>
          <DialogDescription className="mt-1 max-w-2xl">{step?.body ?? feature?.body}</DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step ? (
            <>
              {step.drawing}
              <Callouts items={step.callouts} />
            </>
          ) : feature ? (
            <>
              {feature.drawing}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-line bg-accent-soft/40 px-3.5 py-3">
                <p className="flex items-start gap-2 text-sm text-ink">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span>
                    <span className="font-semibold">Try this:</span> {feature.tryThis}
                  </span>
                </p>
                <Button asChild size="sm" variant="secondary">
                  <Link href={feature.action.href(project)} onClick={() => close(false)}>
                    {feature.action.label}
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <div className="flex items-center gap-1.5" aria-label={`${index + 1} of ${items.length}`}>
            {items.map((item, dot) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Go to ${item.title}`}
                aria-current={dot === index ? "step" : undefined}
                onClick={() => setIndex(dot)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  dot === index ? "w-5 bg-accent" : "w-1.5 bg-surface-3 hover:bg-ink-subtle",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 || chapter === "features" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (index > 0 ? setIndex(index - 1) : go("setup", setup.length - 1))}
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => close(false)}>
                Skip the tour
              </Button>
            )}
            {!last ? (
              <Button size="sm" onClick={() => setIndex(index + 1)}>
                Next
                <ArrowRight aria-hidden />
              </Button>
            ) : chapter === "setup" ? (
              <Button size="sm" onClick={() => go("features")}>
                Next: what&apos;s different
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={`/p/${project}/start`} onClick={() => close(false)}>
                  Start your first run
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
