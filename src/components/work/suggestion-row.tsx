"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock, Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow, RowIcon } from "@/components/ui/list-row";
import { RemoveButton } from "@/components/work/row-actions";
import { useDecideSuggestion } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { SuggestionDto } from "@/lib/work/serialize";
import type { SuggestionStatus } from "@/lib/work/types";
import { formatRelativeTime } from "@/lib/utils";

/**
 * One thing an agent thinks should happen next, in the Issues & suggestions
 * tab next to the issues.
 *
 * Three decisions, because a recommendation is decided rather than resolved:
 * accepting writes the proposal onto the agent's scope of work so the next run
 * carries it out, dismissing closes it, and snoozing puts it back in a week -
 * which is the honest answer to most good ideas, and beats leaving it open
 * forever as a reproach.
 */
export function SuggestionRow({
  suggestion,
  project,
  inRun = false,
}: {
  suggestion: SuggestionDto;
  project: string;
  /** Shown inside its own run: no link back to it. */
  inRun?: boolean;
}) {
  const decide = useDecideSuggestion();
  const pending = decide.isPending && decide.variables?.suggestionId === suggestion.id;

  async function run(status: SuggestionStatus, snoozeDays?: number) {
    try {
      const result = await decide.mutateAsync({ suggestionId: suggestion.id, status, snoozeDays });
      if (status === "accepted") {
        toast.success("Added to this agent's objectives", {
          description: result.addedObjective
            ? `"${result.addedObjective}" runs from now on. Edit it any time in the agent's scope of work.`
            : "It was already one of this agent's objectives, so nothing was duplicated.",
        });
      } else if (status === "snoozed") {
        toast("Snoozed for a week", {
          description: "It comes back to this tab when the week is up.",
          action: {
            label: "Undo",
            onClick: () => {
              decide
                .mutateAsync({ suggestionId: suggestion.id, status: "open" })
                .then(() => toast.success("Back in your suggestions"))
                .catch((caught: unknown) => toast.error(errorMessage(caught)));
            },
          },
        });
      } else if (status === "dismissed") {
        toast("Dismissed", {
          description: `${suggestion.agent.name} will not raise this again.`,
          action: {
            label: "Undo",
            onClick: () => {
              decide
                .mutateAsync({ suggestionId: suggestion.id, status: "open" })
                .then(() => toast.success("Back in your suggestions"))
                .catch((caught: unknown) => toast.error(errorMessage(caught)));
            },
          },
        });
      }
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  const decided = !suggestion.pending;

  return (
    <ListRow
      muted={decided}
      leading={
        <RowIcon>
          <Sparkles />
        </RowIcon>
      }
      title={suggestion.summary}
      badges={
        <>
          <Badge tone="accent">
            <Sparkles aria-hidden />
            Suggestion
          </Badge>
          {suggestion.status === "accepted" ? (
            <Badge tone="positive">Accepted</Badge>
          ) : suggestion.status === "dismissed" ? (
            <Badge tone="neutral">Dismissed</Badge>
          ) : suggestion.status === "snoozed" && !suggestion.pending ? (
            <Badge tone="neutral">
              <Clock aria-hidden />
              Snoozed
            </Badge>
          ) : null}
        </>
      }
      body={
        <div className="space-y-1.5">
          <p className="text-ink-muted">{suggestion.rationale}</p>
          <p className="rounded-sm border border-line bg-surface-2/60 px-2.5 py-1.5 text-ink">
            <span className="text-ink-muted">Proposed next step: </span>
            {suggestion.proposal}
          </p>
        </div>
      }
      meta={
        <>
          <span>{suggestion.agent.name}</span>
          <span aria-hidden>·</span>
          <span>raised by the agent</span>
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(suggestion.createdAt)}</span>
          {suggestion.actionItemId && !inRun ? (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/p/${project}/work/${suggestion.actionItemId}`}
                className="text-accent hover:underline"
              >
                View the run
              </Link>
            </>
          ) : null}
        </>
      }
      trailing={
        suggestion.pending ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" loading={pending} onClick={() => void run("accepted")}>
              <Check aria-hidden />
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => void run("snoozed", 7)}
            >
              <Clock aria-hidden />
              Snooze
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => void run("dismissed")}>
              <X aria-hidden />
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" loading={pending} onClick={() => void run("open")}>
              <Undo2 aria-hidden />
              Reopen
            </Button>
            <RemoveButton targets={[{ kind: "suggestion", id: suggestion.id }]} what="this suggestion" />
          </div>
        )
      }
    />
  );
}
