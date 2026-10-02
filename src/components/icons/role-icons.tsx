import * as React from "react";

/**
 * Cute custom SVG icons: the sparkle fallback and the "start from scratch" scribble.
 *
 * Designed with bubbly rounded curves, playful characterful details,
 * sweet micro-accents (sparkles, hearts, smiling faces), and duotone
 * depth fills. Sized on a standard 24x24 viewBox to scale cleanly
 * from micro pills (14px) to showcase cards (28px+).
 */

export function SparklesCuteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Main big sparkle with soft fill */}
      <path
        d="M12 2.5C12 7.5 7.5 12 2.5 12c5 0 9.5 4.5 9.5 9.5 0-5 4.5-9.5 9.5-9.5-5 0-9.5-4.5-9.5-9.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Secondary sparkle top-right */}
      <path
        d="M18.5 3.5c0 2-1.5 3.5-3.5 3.5 2 0 3.5 1.5 3.5 3.5 0-2 1.5-3.5 3.5-3.5-2 0-3.5-1.5-3.5-3.5Z"
        fill="currentColor"
      />
      {/* Tiny twinkle bottom-left */}
      <circle cx="5" cy="19" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function ScratchCuteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cute tilted pencil */}
      <path
        d="M4.5 19.5l3.5-.8 10.7-10.7a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L4.8 15.5l-.3 4Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 7l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Pencil tip point */}
      <path d="M4.5 19.5l1.5-1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Sparkle of new idea */}
      <path
        d="M19 2l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4Z"
        fill="currentColor"
      />
      <circle cx="7" cy="4" r="0.8" fill="currentColor" />
    </svg>
  );
}
