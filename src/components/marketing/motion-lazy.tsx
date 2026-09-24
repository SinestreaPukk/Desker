"use client";

/**
 * Everything on the landing page that needs Motion, in one chunk.
 *
 * This module is only ever imported lazily by ./reveal.tsx, after hydration
 * and only when the visitor has not asked for reduced motion - so the library
 * is never on the critical path and never in the HTML a crawler reads.
 */
import * as React from "react";
import { motion } from "motion/react";

/** The same curve as .glass and .lift in globals.css: ease-out, no overshoot. */
const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * A reveal should be felt, not watched. 280ms and 10px is about the threshold
 * where the eye registers that something arrived without waiting for it - long
 * enough to read as deliberate, short enough that scrolling never outruns it.
 */
const DURATION = 0.28;
const DISTANCE = 10;

export function MotionReveal({
  children,
  startHidden,
  delay = 0,
  y = DISTANCE,
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
      transition={{ duration: DURATION, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
