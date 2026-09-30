"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Recognition over recall. Fields that take plain-language instructions show
 * (a) clickable phrasings that work, and (b) a live reading of what the
 * owner has typed as the agent will understand it - so they see the effect
 * while writing, not after the first bad conversation.
 */

function Reading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-dashed border-line bg-surface-2/60 px-3 py-2 text-sm", className)} aria-live="polite">
      <span className="eyebrow mr-1.5 inline-flex items-center gap-1">
        <Sparkles className="size-3" aria-hidden />
        {label}
      </span>
      <span className="text-ink-muted">{children}</span>
    </div>
  );
}

export function ContextHelper({ answered, total }: { answered: number; total: number }) {
  return (
    <Reading label="Before every run the agent knows">
      {answered === 0
        ? "Its name, its job, and whatever the project shares - nothing about this role in particular. One answer above changes every draft it writes."
        : `Whatever the project shares, then your ${answered} answer${answered === 1 ? "" : "s"} of ${total}, quoted verbatim at the start of every run.`}
    </Reading>
  );
}
