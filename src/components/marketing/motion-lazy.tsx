"use client";

/**
 * Everything on the landing page that needs Motion, in one chunk.
 *
 * This module is only ever imported lazily by ./reveal.tsx, after hydration
 * and only when the visitor has not asked for reduced motion - so the library
 * is never on the critical path and never in the HTML a crawler reads.
 */
import * as React from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function MotionReveal({
  children,
  startHidden,
  delay = 0,
  y = 24,
  className,
}: {
  children: React.ReactNode;
  /** False when the element was already on screen when Motion arrived - no flash. */
  startHidden: boolean;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={startHidden ? { opacity: 0, y } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Counts from zero to `value` the first time it scrolls into view. */
export function MotionCount({
  value,
  startHidden,
  format,
}: {
  value: number;
  startHidden: boolean;
  format: (n: number) => string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = React.useState(startHidden ? 0 : value);

  React.useEffect(() => {
    if (!inView || !startHidden) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, startHidden, value]);

  return <span ref={ref}>{format(shown)}</span>;
}

/** Drifts its children by `distance` px over the first screen of scrolling. */
export function MotionParallax({
  children,
  distance,
  className,
}: {
  children: React.ReactNode;
  distance: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, reduced ? 0 : distance]);
  return (
    <motion.div className={className} style={{ y }} aria-hidden>
      {children}
    </motion.div>
  );
}
