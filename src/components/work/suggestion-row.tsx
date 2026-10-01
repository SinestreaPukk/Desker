"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { RemoveButton } from "@/components/work/row-actions";
import { useDecideSuggestion } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { SuggestionDto } from "@/lib/work/serialize";
import type { SuggestionStatus } from "@/lib/work/types";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

/**
 * One thing an agent thinks should happen next - a question for the owner,
 * decided in Needs you beside the approvals and flags.
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
}: {
  suggestion: SuggestionDto;
  project: string;
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
          description: "It comes back to Needs you when the week is up.",
          action: {
            label: "Undo",
            onClick: () => {
              decide
                .mutateAsync({ suggestionId: suggestion.id, status: "open" })
                .then(() => toast.success("Back in Needs you"))
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
                .then(() => toast.success("Back in Needs you"))
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

  // Only a decided suggestion carries a badge; the heading above already says what it is.
  const state =
    suggestion.status === "accepted" ? (
      <Badge tone="positive">Accepted</Badge>
    ) : suggestion.status === "dismissed" ? (
      <Badge tone="neutral">Dismissed</Badge>
    ) : suggestion.status === "delegated" ? (
      <Badge tone="accent">Delegated</Badge>
    ) : suggestion.status === "snoozed" && !suggestion.pending ? (
      <Badge tone="neutral">
        <Clock aria-hidden />
        Snoozed
      </Badge>
    ) : null;

  const body = (
    <div className="space-y-1.5">
      <p className="text-ink-muted">{suggestion.rationale}</p>
      <p className="text-ink">
        <span className="font-medium">Proposed next step:</span> {suggestion.proposal}
      </p>
    </div>
  );

  const actions = suggestion.pending ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" loading={pending} onClick={() => void run("accepted")}>
        <Check aria-hidden />
        Accept
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run("snoozed", 7)}>
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
  );

  // Mail's shape: the agent who suggested it on top, with their
  // face, then what they suggest.
  return (
    <ListRow
      muted={decided}
      leading={
        <AgentAvatar name={suggestion.agent.name} src={suggestion.agent.avatarUrl} seed={suggestion.agent.id} size="md" />
      }
      title={suggestion.agent.name}
      aside={<span title={formatDateTime(suggestion.createdAt)}>{formatRelativeTime(suggestion.createdAt)}</span>}
      body={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium text-ink">{suggestion.summary}</p>
            {state}
          </div>
          {body}
        </div>
      }
      meta={
        <>
          <span>Suggested by the agent</span>
          {suggestion.actionItemId ? (
            <>
              <span aria-hidden>·</span>
              <Link href={`/p/${project}/work/${suggestion.actionItemId}`} className="text-accent hover:underline">
                View the run
              </Link>
            </>
          ) : null}
        </>
      }
      trailing={actions}
    />
  );
}
