import * as React from "react";

/**
 * Cuter custom SVG icons for each AI agent role across Desker.
 *
 * Designed with bubbly rounded curves, playful characterful details,
 * sweet micro-accents (sparkles, hearts, smiling faces), and duotone
 * depth fills. Sized on a standard 24x24 viewBox to scale cleanly
 * from micro pills (14px) to showcase cards (28px+).
 */

export function CustomerSupportIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Headphone band */}
      <path
        d="M4 12v-1a8 8 0 0 1 16 0v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Little antenna with glowing orb */}
      <path
        d="M12 7V4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" />
      {/* Rounded bot head */}
      <rect
        x="5"
        y="7"
        width="14"
        height="11"
        rx="4"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Chubby ear cushions */}
      <rect
        x="2.25"
        y="10.5"
        width="2.75"
        height="5"
        rx="1.375"
        fill="currentColor"
      />
      <rect
        x="19"
        y="10.5"
        width="2.75"
        height="5"
        rx="1.375"
        fill="currentColor"
      />
      {/* Happy eyes */}
      <circle cx="9.25" cy="11.5" r="1.2" fill="currentColor" />
      <circle cx="14.75" cy="11.5" r="1.2" fill="currentColor" />
      {/* Rosy blush */}
      <circle
        cx="7.5"
        cy="13.25"
        r="0.9"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <circle
        cx="16.5"
        cy="13.25"
        r="0.9"
        fill="currentColor"
        fillOpacity="0.4"
      />
      {/* Sweet smile */}
      <path
        d="M10.5 13.75a2 2 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Headset mic with round tip */}
      <path
        d="M19 14.5v1a2.5 2.5 0 0 1-2.5 2.5H15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="14.25" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function ClientOnboardingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Rocket fuselage */}
      <path
        d="M14.5 3.5C11.8 4.2 8.5 7.8 8 11.5l4.5 4.5c3.7-.5 7.3-3.8 8-6.5l-6-6Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cute porthole window */}
      <circle
        cx="13.25"
        cy="9.75"
        r="2"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12.75" cy="9.25" r="0.6" fill="currentColor" />
      {/* Left wing fin */}
      <path
        d="M8.2 11.8 5.5 13.5c-.8.5-1 1.5-.5 2.2l1.3 1.3c.7.7 1.8.5 2.2-.4l1.2-2.4"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right wing fin */}
      <path
        d="M12.2 15.8 14 18.5c.5.8 1.5 1 2.2.5l1.3-1.3c.7-.7.5-1.8-.4-2.2l-2.4-1.2"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Thruster puff flame */}
      <path
        d="M8.5 16 6.2 18.3a1.8 1.8 0 0 0 2.5 2.5L11 18.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Destination star */}
      <path
        d="M19 2.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z"
        fill="currentColor"
      />
      {/* Guide sparkle */}
      <path
        d="M21.5 11l.3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3Z"
        fill="currentColor"
      />
      {/* Small sparkle */}
      <circle cx="4" cy="8.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function ResearcherIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Research document with folded corner */}
      <path
        d="M12 3H5.5A2.5 2.5 0 0 0 3 5.5v13A2.5 2.5 0 0 0 5.5 21h7a2.5 2.5 0 0 0 2.5-2.5V6L12 3Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Folded paper corner */}
      <path
        d="M12 3v3h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Research source note lines */}
      <path
        d="M6 8.5h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6 12h2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6 15.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Overlapping cute magnifying glass */}
      <circle
        cx="14.5"
        cy="13.5"
        r="4.8"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Lucky discovery star focused in the lens */}
      <path
        d="M14.5 11.2l.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.2.7.2-1.4-1-1 1.4-.2Z"
        fill="currentColor"
      />
      {/* Magnifier handle */}
      <path
        d="M18 17l3 3"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Discovery insight sparkle at top right */}
      <path
        d="M18.5 2.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4Z"
        fill="currentColor"
      />
      {/* Mini twinkle */}
      <circle cx="21" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function MarketerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Megaphone body */}
      <path
        d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l5 3.5a1 1 0 0 0 1.5-.9V6.4a1 1 0 0 0-1.5-.9L7 9H4.5A1.5 1.5 0 0 0 3 10.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rounded speaker bell */}
      <path
        d="M13.5 6.5c1.8 1.4 2.5 3.5 2.5 5.5s-.7 4.1-2.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Cute angled handle */}
      <path
        d="M6 15v3.5a1.5 1.5 0 0 0 3 0V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Floating love heart */}
      <path
        d="M18.8 8.8a1.5 1.5 0 0 1 2.1 0 1.5 1.5 0 0 1 0 2.1l-1.4 1.4-1.4-1.4a1.5 1.5 0 0 1 .7-2.1Z"
        fill="currentColor"
      />
      {/* Sparkle 1 */}
      <path
        d="M17.5 4l.3.7.7.3-.7.3-.3.7-.3-.7-.7-.3.7-.3Z"
        fill="currentColor"
      />
      {/* Sparkle 2 */}
      <path
        d="M20.5 15.5l.3.6.6.3-.6.3-.3.6-.3-.6-.6-.3.6-.3Z"
        fill="currentColor"
      />
      {/* Sound wave */}
      <path
        d="M18 12.5a3.5 3.5 0 0 0-1-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SecretaryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Chubby briefcase */}
      <rect
        x="3"
        y="7"
        width="18"
        height="13.5"
        rx="3.5"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <path
        d="M8.5 7V4.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Midline horizontal seam */}
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      {/* Heart clasp in center */}
      <path
        d="M12 10.7a1 1 0 0 0-1.4 0 1 1 0 0 0 0 1.4l1.4 1.4 1.4-1.4a1 1 0 0 0 0-1.4 1 1 0 0 0-1.4 0Z"
        fill="currentColor"
      />
      {/* Cute smiling face */}
      <circle cx="8" cy="15.5" r="1.1" fill="currentColor" />
      <circle cx="16" cy="15.5" r="1.1" fill="currentColor" />
      {/* Rosy blush */}
      <circle cx="6.5" cy="16.5" r="0.75" fill="currentColor" fillOpacity="0.35" />
      <circle cx="17.5" cy="16.5" r="0.75" fill="currentColor" fillOpacity="0.35" />
      {/* Happy smile */}
      <path
        d="M10.5 16.25a2 2 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Corner badge tag */}
      <path
        d="M19 9.5l1.5-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DevSupportIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Kitty ears on monitor */}
      <path
        d="M5.5 5.5 3.8 2.8c-.3-.5.2-1.1.7-.9l3.5 1.6"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 5.5l1.7-2.7c.3-.5-.2-1.1-.7-.9l-3.5 1.6"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Monitor body */}
      <rect
        x="3"
        y="5"
        width="18"
        height="12.5"
        rx="3"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Left bracket < */}
      <path
        d="M7 9.5 5.8 11.2a.5.5 0 0 0 0 .6L7 13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cute eyes */}
      <circle cx="10" cy="11.2" r="1.1" fill="currentColor" />
      <circle cx="14" cy="11.2" r="1.1" fill="currentColor" />
      {/* Little smile */}
      <path
        d="M11.2 12.5a1.2 1.2 0 0 0 1.6 0"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Right bracket > */}
      <path
        d="M17 9.5 18.2 11.2a.5.5 0 0 1 0 .6L17 13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Monitor stand & base */}
      <path
        d="M12 17.5V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 20.5h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Tiny code sparkle */}
      <circle cx="18.5" cy="7" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function SalesDevIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer target circle */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Middle dashed ring */}
      <circle
        cx="12"
        cy="12"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray="3 2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Center lucky star in bullseye */}
      <path
        d="M12 9.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z"
        fill="currentColor"
      />
      {/* Playful arrow hitting bullseye */}
      <path
        d="M19 5 14.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Arrow heart fletching */}
      <path
        d="M17.5 3.5a1.2 1.2 0 0 1 1.7 0 1.2 1.2 0 0 1 0 1.7l-.7.8 1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Celebration sparkles */}
      <path
        d="M4.5 6l.3.6.6.3-.6.3-.3.6-.3-.6-.6-.3.6-.3Z"
        fill="currentColor"
      />
      <circle cx="20" cy="15" r="1" fill="currentColor" />
      <circle cx="5" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function PeopleOpsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Warm welcoming hug arms */}
      <path
        d="M4.5 12.2c-1.8-.4-2.8 1.2-1.6 2.4 1.2 1.2 2.8.9 3.8-.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 12.2c1.8-.4 2.8 1.2 1.6 2.4-1.2 1.2-2.8.9-3.8-.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Plump cute heart body */}
      <path
        d="M12 20.8C7.5 17.5 4 14.2 4 10.2 4 7.2 6.2 5 9 5c1.7 0 3.2.9 4 2.2.8-1.3 2.3-2.2 4-2.2 2.8 0 5 2.2 5 5.2 0 4-3.5 7.3-8 10.6Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Happy round eyes */}
      <circle cx="9.25" cy="11.5" r="1.15" fill="currentColor" />
      <circle cx="14.75" cy="11.5" r="1.15" fill="currentColor" />
      {/* Sweet rosy blush cheeks */}
      <circle
        cx="7.25"
        cy="13.25"
        r="0.85"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <circle
        cx="16.75"
        cy="13.25"
        r="0.85"
        fill="currentColor"
        fillOpacity="0.4"
      />
      {/* Loving cheerful smile */}
      <path
        d="M10.5 13.5a1.8 1.8 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Top warmth sparkle rays */}
      <path
        d="M12 1.8l.3.7.7.3-.7.3-.3.7-.3-.7-.7-.3.7-.3Z"
        fill="currentColor"
      />
      <circle cx="4" cy="4.5" r="0.8" fill="currentColor" />
      <circle cx="20" cy="4.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

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
