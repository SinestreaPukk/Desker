"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpaceKind } from "@/components/space-kind";
import { spaceCopy } from "@/lib/space-copy";

/**
 * Recognition over recall. Fields that take plain-language instructions show
 * (a) clickable phrasings that work, and (b) a live reading of what the
 * owner has typed as the agent will understand it - so they see the effect
 * while writing, not after the first bad conversation.
 */

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-ink-muted transition-colors hover:border-accent-line hover:bg-accent-soft/40 hover:text-ink"
    >
      {children}
    </button>
  );
}

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

export function EscalationRuleHelper({
  value,
  onPick,
}: {
  value: string;
  onPick: (text: string) => void;
}) {
  const copy = spaceCopy(useSpaceKind());
  const text = value.trim();
  const condition = text.replace(/^escalate\s+(immediately\s+)?(if|when)\s+/i, "").replace(/\.$/, "");
  return (
    <div className="space-y-2">
      <Reading label="The agent reads this as">
        {text
          ? <>Stop and check with you when <strong className="font-medium text-ink">{condition}</strong>. It judges this from what happens, not from keywords.</>
          : copy.noRuleYet}
      </Reading>
      {!text ? (
        <div className="flex flex-wrap gap-1.5">
          {copy.ruleExamples.map((example) => (
            <Chip key={example} onClick={() => onPick(example)}>
              {example}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Empty-state only: once there are objectives the textarea above already shows them. */
export function ObjectivesHelper({ objectives, onPick }: { objectives: string[]; onPick?: (text: string) => void }) {
  const examples = spaceCopy(useSpaceKind()).objectiveExamples;
  if (objectives.length > 0) return null;
  return (
    <div className="space-y-2">
      <Reading label="Each run will try to">
        Nothing yet. One outcome per line; the agent works down the list and reports on each. For example:
      </Reading>
      {onPick ? (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <Chip key={example} onClick={() => onPick(example)}>
              {example}
            </Chip>
          ))}
        </div>
      ) : null}
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
