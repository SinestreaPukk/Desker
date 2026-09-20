import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium " +
    "leading-5 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-muted",
        accent: "border-accent-line bg-accent-soft text-accent-soft-fg",
        positive: "border-positive-line bg-positive-soft text-positive",
        warning: "border-warning-line bg-warning-soft text-warning",
        danger: "border-danger-line bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

const SEVERITY_TONE = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
} as const;

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;
  const tone =
    SEVERITY_TONE[severity as keyof typeof SEVERITY_TONE] ?? "neutral";
  return (
    <Badge tone={tone} className="uppercase tracking-wide">
      {severity}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "neutral" | "positive" | "warning" | "danger"; label: string }> = {
    published: { tone: "positive", label: "Published" },
    draft: { tone: "warning", label: "Draft" },
    open: { tone: "accent" as never, label: "Open" },
    escalated: { tone: "danger", label: "Escalated" },
    resolved: { tone: "neutral", label: "Resolved" },
    ready: { tone: "positive", label: "Ready" },
    pending: { tone: "warning", label: "Processing" },
    failed: { tone: "danger", label: "Failed" },
  };
  const entry = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
