"use client";

/**
 * Scroll choreography for the landing page, without a JavaScript dependency
 * for reading it.
 *
 * The server renders every element visible and in place. After hydration,
 * and only if the visitor has not asked for reduced motion, the Motion chunk
 * is fetched; elements that are still below the fold then get their
 * fade-and-rise, and elements already on screen are left exactly as they are.
 * With JavaScript off, or motion reduced, the page is simply the static one.
 */
import * as React from "react";

type MotionModule = typeof import("./motion-lazy");

let loading: Promise<MotionModule> | null = null;

function loadMotion(): Promise<MotionModule> {
  if (!loading) loading = import("./motion-lazy");
  return loading;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Entirely below the fold at the moment Motion arrives = worth animating in. */
function belowFold(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.getBoundingClientRect().top >= window.innerHeight;
}

type Ready = { mod: MotionModule; startHidden: boolean };

/**
 * Resolves to the Motion module once - never under reduced motion - and, in
 * the same state update, whether the element was still below the fold at
 * that moment, so an element the visitor is looking at never blinks.
 */
function useMotion(ref: React.RefObject<HTMLElement | null>): Ready | null {
  const [ready, setReady] = React.useState<Ready | null>(null);
  React.useEffect(() => {
    if (prefersReducedMotion()) return;
    let active = true;
    void loadMotion().then((mod) => {
      if (active) setReady({ mod, startHidden: belowFold(ref.current) });
    });
    return () => {
      active = false;
    };
  }, [ref]);
  return ready;
}

export function Reveal({
  children,
  delay,
  y,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const ready = useMotion(ref);

  if (!ready) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <ready.mod.MotionReveal startHidden={ready.startHidden} delay={delay} y={y} className={className}>
      {children}
    </ready.mod.MotionReveal>
  );
}

/** Decorative only: wraps background shapes so they drift as the page scrolls. */
export function Parallax({
  children,
  distance = 120,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const ready = useMotion(ref);
  if (!ready) {
    return (
      <div ref={ref} className={className} aria-hidden>
        {children}
      </div>
    );
  }
  return (
    <ready.mod.MotionParallax distance={distance} className={className}>
      {children}
    </ready.mod.MotionParallax>
  );
}
