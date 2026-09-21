import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium " +
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

/**
 * Every status in the product, one look. Agents, conversations, issues,
 * documents, action items, drafts, roles and invitations all go through
 * here, so a state reads the same in a list, a card and a detail page.
 */
const STATUS: Record<string, { tone: "neutral" | "accent" | "positive" | "warning" | "danger"; label: string }> = {
  // agents
  published: { tone: "positive", label: "Published" },
  draft: { tone: "warning", label: "Draft" },
  // conversations and issues
  open: { tone: "accent", label: "Open" },
  escalated: { tone: "danger", label: "Escalated" },
  resolved: { tone: "neutral", label: "Resolved" },
  // documents
  ready: { tone: "positive", label: "Ready" },
  pending: { tone: "warning", label: "Processing" },
  // action items
  queued: { tone: "neutral", label: "Queued" },
  in_progress: { tone: "accent", label: "Running" },
  needs_approval: { tone: "warning", label: "Needs approval" },
  approved: { tone: "accent", label: "Approved" },
  executing_external: { tone: "accent", label: "Sending" },
  done: { tone: "positive", label: "Done" },
  failed: { tone: "danger", label: "Failed" },
  rejected: { tone: "neutral", label: "Rejected" },
  // drafts
  sent: { tone: "positive", label: "Sent" },
  // roles
  owner: { tone: "accent", label: "Owner" },
  admin: { tone: "neutral", label: "Admin" },
  member: { tone: "neutral", label: "Member" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS[status] ?? { tone: "neutral" as const, label: status.replace(/_/g, " ") };
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}
