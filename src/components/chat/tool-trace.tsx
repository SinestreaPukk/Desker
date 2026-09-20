"use client";

import { Bug, CircleCheck, Lightbulb, Loader2, Search, UserRoundCheck } from "lucide-react";
import { toolLabel, type ToolActivity } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  search_company_context: Search,
  log_issue: Bug,
  log_suggestion: Lightbulb,
  escalate_to_human: UserRoundCheck,
};

/**
 * Shows what the agent did, not just what it said. A client seeing
 * "Issue logged" is the difference between a promise and a receipt.
 */
export function ToolTrace({
  activity,
  className,
}: {
  activity: ToolActivity[];
  className?: string;
}) {
  if (activity.length === 0) return null;

  return (
    <ul className={cn("space-y-1.5", className)} aria-label="Agent actions">
      {activity.map((item) => {
        const Icon = ICONS[item.name] ?? Search;
        const running = item.state === "running";
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
              running
                ? "border-line bg-surface-2 text-ink-muted"
                : "border-accent-line bg-accent-soft text-accent-soft-fg",
            )}
          >
            {running ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Icon className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="font-medium">{toolLabel(item.name)}</span>
            {item.detail ? (
              <>
                <span aria-hidden className="text-current/50">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <CircleCheck className="size-3" aria-hidden />
                  {item.detail}
                </span>
              </>
            ) : null}
            <span className="sr-only">{running ? "in progress" : "complete"}</span>
          </li>
        );
      })}
    </ul>
  );
}
