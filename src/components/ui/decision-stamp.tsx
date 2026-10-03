import { cn } from "@/lib/shared/utils";

/**
 * The decision, stamped: a round ink stamp in the hand face, set at an angle.
 * It lands with a short press when it first appears (globals.css,
 * .stamp-in). Used where a decision on outgoing work is shown - the public
 * site's demos and a run's page in the app.
 */
export type StampKind = "sent" | "published" | "approved" | "rejected";

export function DecisionStamp({ kind, className }: { kind: StampKind; className?: string }) {
  const label = { sent: "Sent", published: "Published", approved: "Approved", rejected: "Rejected" }[kind];
  return (
    <span
      aria-hidden
      className={cn(
        "stamp-in pointer-events-none absolute flex size-20 items-center justify-center rounded-full border-[2.5px] font-hand text-hand-cta font-bold",
        kind === "rejected" ? "border-ink-muted/70 text-ink-muted" : "border-positive/80 text-positive",
        className,
      )}
    >
      {label}
    </span>
  );
}
