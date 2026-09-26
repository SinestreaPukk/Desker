import * as React from "react";

/**
 * Custom SVG icons crafted specifically for the Insights dashboard across Desker.
 *
 * Designed with duotone depth fills, crisp 1.75px strokes, rounded terminals,
 * and characterful details that match Desker's design system. Sized on a standard
 * 24x24 viewBox to scale cleanly from micro-badges (14px) to empty-state heroes (24px+).
 */

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean;
}

/**
 * Client Conversations (Lead KPI)
 * Overlapping dialogue bubbles with duotone depth, active communication dots,
 * and a discovery spark signaling AI staff handling client dialogue.
 */
export function InsightConversationsIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Secondary peer bubble in background */}
      <path
        d="M10 5.5h6.2a4.3 4.3 0 0 1 4.3 4.3v1.8a4.3 4.3 0 0 1-3.2 4.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Dialogue intelligence spark */}
      <path
        d="M19 3.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z"
        fill="currentColor"
      />
      {/* Primary chat bubble with duotone fill */}
      <path
        d="M3.5 8.75C3.5 6.95 4.95 5.5 6.75 5.5h7C15.55 5.5 17 6.95 17 8.75v4.5c0 1.8-1.45 3.25-3.25 3.25H7.75L4.5 19v-3.25C3.9 15.15 3.5 14.1 3.5 13.25v-4.5Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Speech pulse dots */}
      <circle cx="7.25" cy="11" r="1.1" fill="currentColor" />
      <circle cx="10.25" cy="11" r="1.1" fill="currentColor" />
      <circle cx="13.25" cy="11" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * Handed to a Person (Escalation KPI)
 * A teammate avatar with an active handoff beacon & transfer arrow,
 * communicating conversations escalated to human staff.
 */
export function InsightEscalationIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Teammate head with duotone fill */}
      <circle
        cx="8.5"
        cy="7.5"
        r="3"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Teammate shoulders / torso */}
      <path
        d="M3.5 19c0-3.1 2.4-5.5 5-5.5 1.5 0 2.8.6 3.7 1.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Duotone fill under shoulders */}
      <path
        d="M3.5 19c0-3.1 2.4-5.5 5-5.5 1.5 0 2.8.6 3.7 1.6L12.5 19H3.5Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      {/* Escalation handoff arrow */}
      <path
        d="M13.5 11.5L19.5 5.5M19.5 5.5H15M19.5 5.5V10"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Active notification indicator */}
      <circle cx="19.5" cy="14" r="1.5" fill="currentColor" />
      <path
        d="M19.5 17.5v1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Clients Said It Helped (Positive Rating KPI)
 * A warm, rounded thumbs-up with duotone depth, smooth curves,
 * and a celebratory satisfaction sparkle.
 */
export function InsightHelpfulIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Cuff / wrist anchor */}
      <rect
        x="3"
        y="10.5"
        width="3.25"
        height="8.5"
        rx="1.6"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Upright thumb & hand palm */}
      <path
        d="M6.25 11.5V17a2 2 0 0 0 2 2h5.5a2.75 2.75 0 0 0 2.6-1.8l1.3-3.9a1.75 1.75 0 0 0-1.65-2.3h-3.6c.35-1.1.5-2.2.5-3.3 0-1.5-.9-2.4-1.9-2.4-.9 0-1.5.7-1.7 1.6l-1.3 3.6H6.25Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Satisfaction sparkle accent */}
      <path
        d="M19 4l.35.8.8.35-.8.35-.35.8-.35-.8-.8-.35.8-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Raised For You To Deal With (Issues & Suggestions KPI)
 * A refined triage clipboard tag with an attention exclamation indicator
 * and item rows, representing tickets, feedback, and suggestions.
 */
export function InsightIssuesIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Triage card / ticket body */}
      <path
        d="M6 5.5A2.5 2.5 0 0 1 8.5 3h7A2.5 2.5 0 0 1 18 5.5V19a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Clipboard clamp / hanger */}
      <path
        d="M9.5 3V2.5A1.5 1.5 0 0 1 11 1h2a1.5 1.5 0 0 1 1.5 1.5V3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Alert exclamation for triage */}
      <path
        d="M12 7.5v3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="13.25" r="1.1" fill="currentColor" />
      {/* Backlog task line */}
      <path
        d="M9.5 16.5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Answered From Documents (Knowledge Retrieval Hit Rate KPI)
 * A document with folded corner and a magnifying lens illuminating found text,
 * communicating knowledge base lookup success.
 */
export function InsightKnowledgeRetrievalIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Knowledge document outline & duotone fill */}
      <path
        d="M4.5 4.5A2.5 2.5 0 0 1 7 2h6.5L18.5 6.5V10c-.7-.3-1.4-.5-2.2-.5H16V7h-3.5V3.5H7A1.5 1.5 0 0 0 5.5 5v12.5A1.5 1.5 0 0 0 7 19h3.5c.2.6.4 1.1.7 1.6H7A2.5 2.5 0 0 1 4.5 18V4.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Text lines in document */}
      <path
        d="M8 8h2.5M8 11.5h1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Magnifying discovery lens */}
      <circle
        cx="15.5"
        cy="15.5"
        r="4"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M18.5 18.5L21.5 21.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Knowledge spark inside the lens */}
      <circle cx="15.5" cy="15.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

/**
 * Time Your Team Did Not Spend (Hours Saved Lead KPI)
 * A velocity clock dial with forward momentum sweep and efficiency spark,
 * communicating reclaimed hours and productivity gained.
 */
export function InsightTimeSavedIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Outer velocity sweep arc */}
      <path
        d="M5.5 4.5A9.5 9.5 0 0 1 20 8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Clock dial body */}
      <circle
        cx="12"
        cy="12.5"
        r="8"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Dynamic forward-pointing clock hands */}
      <path
        d="M12 8.5v4l3 1.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="1.25" fill="currentColor" />
      {/* Efficiency micro-spark */}
      <path
        d="M20.5 3.5l.35.8.8.35-.8.35-.35.8-.35-.8-.8-.35.8-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Tasks Done On Their Own (Autonomous Runs KPI)
 * An autonomous loop with active runner arrow and central node,
 * signaling automated background jobs executing independently.
 */
export function InsightTasksRunIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Outer autonomous runner cycle */}
      <path
        d="M12 3.5a8.5 8.5 0 0 1 7.8 5.2M20 5v4h-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 20.5a8.5 8.5 0 0 1-7.8-5.2M4 19v-4h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central autonomous core with duotone fill */}
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Forward execution chevron */}
      <path
        d="M11 10l2.5 2-2.5 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Stopped Before Finishing (Failed / Halted Runs KPI)
 * A rounded halt shield with duotone fill and distinct stop cross,
 * indicating tasks that hit an error or halted before completion.
 */
export function InsightStoppedIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Octagonal halt badge */}
      <path
        d="M7.75 3h8.5L21 7.75v8.5L16.25 21h-8.5L3 16.25v-8.5L7.75 3Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crisp stop cross */}
      <path
        d="M14.5 9.5l-5 5M9.5 9.5l5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Waiting For Your Approval (Approval Gate KPI)
 * An approval checkpoint stamp / hourglass seal,
 * cleanly communicating tasks paused at an approval gate waiting on human signoff.
 */
export function InsightAwaitingApprovalIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Approval badge container */}
      <rect
        x="3.5"
        y="3"
        width="17"
        height="18"
        rx="4"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Hourglass turnaround plates */}
      <path
        d="M8 7h8M8 17h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Hourglass body */}
      <path
        d="M8.5 7.5c0 2.2 1.5 3.3 2.5 4.5-1 1.2-2.5 2.3-2.5 4.5M15.5 7.5c0 2.2-1.5 3.3-2.5 4.5 1 1.2 2.5 2.3 2.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Turnaround sand dot */}
      <circle cx="12" cy="14.25" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * Estimated Cost (Token / Model Spend KPI)
 * Dimensional stacked token coins with duotone facets and currency symbol,
 * representing model usage and billing meter.
 */
export function InsightCostIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Bottom coin */}
      <ellipse
        cx="14"
        cy="15"
        rx="6.5"
        ry="3.25"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M7.5 15v2.25c0 1.8 2.9 3.25 6.5 3.25s6.5-1.45 6.5-3.25V15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Top coin */}
      <ellipse
        cx="9.5"
        cy="8.5"
        rx="6.5"
        ry="3.25"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 8.5v2.25c0 1.8 2.9 3.25 6.5 3.25s6.5-1.45 6.5-3.25V8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Currency symbol on top coin */}
      <path
        d="M9.5 6.5v4M8 7.3h2.2c.5 0 .9.3.9.7 0 .5-.4.8-.9.8H8.8c-.5 0-.9.3-.9.7s.4.8.9.8h2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Value spark */}
      <path
        d="M19.5 4l.35.75.75.35-.75.35-.35.75-.35-.75-.75-.35.75-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Missed Search Query (Content Gaps List Item)
 * A search lens with an unfulfilled query indicator,
 * identifying questions clients asked that documents couldn't answer.
 */
export function InsightMissedQueryIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Lens body with soft fill */}
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Handle */}
      <path
        d="M15.5 15.5L20.5 20.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Unanswered query mark inside lens */}
      <path
        d="M9.5 9a1.5 1.5 0 0 1 2.2-.4c.5.4.6.9.4 1.3-.3.6-.8.9-.8 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="13.25" r="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * No Gaps Found (Content Gaps Empty State)
 * Complete documentation with verified checkmark and celebratory micro-sparkle,
 * signaling 100% document search coverage.
 */
export function InsightNoGapsIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Document parchment */}
      <path
        d="M5 3.5A2.5 2.5 0 0 1 7.5 1h7L20 6.5v13a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 5 19.5v-16Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 1v5.5H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Verification check badge */}
      <circle
        cx="12"
        cy="14"
        r="4"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M10.25 14l1.25 1.25 2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Celebratory sparkles */}
      <path
        d="M2.5 5.5l.35.8.8.35-.8.35-.35.8-.35-.8-.8-.35.8-.35Z"
        fill="currentColor"
      />
      <circle cx="21.5" cy="11.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * Disliked Reply (Unhelpful Reply List Item)
 * A tailored thumbs-down matching the curvature and weight of InsightHelpfulIcon,
 * inverting smoothly for negative feedback items.
 */
export function InsightDislikedReplyIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <g transform="scale(1, -1) translate(0, -24)">
        {/* Cuff / wrist anchor */}
        <rect
          x="3"
          y="10.5"
          width="3.25"
          height="8.5"
          rx="1.6"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        {/* Hand palm and thumb */}
        <path
          d="M6.25 11.5V17a2 2 0 0 0 2 2h5.5a2.75 2.75 0 0 0 2.6-1.8l1.3-3.9a1.75 1.75 0 0 0-1.65-2.3h-3.6c.35-1.1.5-2.2.5-3.3 0-1.5-.9-2.4-1.9-2.4-.9 0-1.5.7-1.7 1.6l-1.3 3.6H6.25Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * Telemetry & Activity Empty State
 * Ascending telemetry metric bars with dynamic trend sweep and readiness sparkles,
 * representing analytics standing by for first client conversations.
 */
export function InsightTelemetryEmptyIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Ascending telemetry bars with duotone fills */}
      <rect
        x="3.5"
        y="13"
        width="3.5"
        height="8"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="9.75"
        y="8.5"
        width="3.5"
        height="12.5"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.24"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="16"
        y="4"
        width="3.5"
        height="17"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Dynamic growth curve */}
      <path
        d="M4.5 13.5c4-3.5 7.5-6.5 14-7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Signal readiness sparkle */}
      <path
        d="M20.5 2.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Tokens Used KPI
 * Microchip processor / compute block with duotone core and data pulses.
 */
export function InsightTokensIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="3"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Collaboration Between Agents KPI
 * Connected team nodes with handoff linkage representing multi-agent collaboration.
 */
export function InsightCollaborationIcon({
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <circle
        cx="7"
        cy="7"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="17"
        cy="7"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="12"
        cy="17.5"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M10.5 7h3M8.5 10l2.5 4.5M15.5 10l-2.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 14l1.5-1.5M10.5 14L9 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
