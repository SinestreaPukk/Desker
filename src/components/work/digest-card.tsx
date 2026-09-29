"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Mail, Radio, TriangleAlert } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RemoveButton } from "@/components/work/row-actions";
import { Note } from "@/components/ui/note";
import { useDigests, useSetDigestRead } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { DigestDto } from "@/lib/work/serialize";
import type { DigestBulletKind } from "@/lib/work/types";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";

const BULLET: Record<
  DigestBulletKind,
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  heads_up: { icon: TriangleAlert, className: "text-warning", label: "Worth knowing" },
  pending: { icon: Clock, className: "text-accent", label: "Waiting on you" },
  done: { icon: CheckCircle2, className: "text-positive", label: "Done" },
};

/** "15 Sep – 22 Sep", or one date and 24hr time when the window is inside a day. */
function period(start: string, end: string): string {
  const from = new Date(start);
  const to = new Date(end);
  const day = { day: "numeric", month: "short" } as const;
  const sameDay = from.toDateString() === to.toDateString();
  return sameDay
    ? `${to.toLocaleDateString(undefined, day)} ${formatTime(to)}`
    : `${from.toLocaleDateString(undefined, day)} – ${to.toLocaleDateString(undefined, day)}`;
}

/** The counts under a digest, in the owner's words rather than the schema's. */
function statLine(digest: DigestDto): string {
  const { stats } = digest;
  const parts = [`${stats.runs} task${stats.runs === 1 ? "" : "s"}`];
  if (stats.drafts > 0) parts.push(`${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`);
  if (stats.awaitingApproval > 0) parts.push(`${stats.awaitingApproval} waiting on you`);
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  return parts.join(" · ");
}

/**
 * One update from one agent, as it lands under Work → Digests. Unread is a left edge
 * and a dot rather than a background wash: a column of these has to stay
 * readable when half of them are new.
 */
export function DigestCard({ digest, project }: { digest: DigestDto; project: string }) {
  const setRead = useSetDigestRead();
  const unread = digest.readAt === null;

  async function toggleRead() {
    try {
      await setRead.mutateAsync({ digestId: digest.id, read: unread });
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <Note tone="lemon">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Unread, the Mail way: one dot, not a stripe and a badge. */}
        <span
          className={unread ? "mt-4 size-2 shrink-0 rounded-full bg-accent" : "mt-4 size-2 shrink-0"}
          aria-label={unread ? "Unread" : undefined}
          role={unread ? "img" : undefined}
        />
        <AgentAvatar
          name={digest.agent.name}
          src={digest.agent.avatarUrl}
          seed={digest.agent.id}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">{digest.agent.name}</span>
            <span className="text-xs text-ink-muted">
              {digest.cadence === "daily" ? "Daily update" : "Weekly update"} ·{" "}
              {period(digest.periodStart, digest.periodEnd)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink">{digest.headline}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => void toggleRead()} loading={setRead.isPending}>
            {unread ? "Mark read" : "Mark unread"}
          </Button>
          <RemoveButton targets={[{ kind: "update", id: digest.id }]} what="this update" />
        </div>
      </div>

      <ul className="space-y-2 border-t border-line px-4 py-3">
        {digest.bullets.map((bullet, index) => {
          const look = BULLET[bullet.kind];
          const Icon = look.icon;
          return (
            <li key={index} className="flex items-start gap-2.5 text-sm text-ink">
              <Icon className={`mt-0.5 size-4 shrink-0 ${look.className}`} aria-hidden />
              <span className="sr-only">{look.label}: </span>
              <span>{bullet.text}</span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span>{statLine(digest)}</span>
        <span aria-hidden>·</span>
        <span title={formatDateTime(digest.createdAt)}>
          {formatTime(digest.createdAt)} · {formatRelativeTime(digest.createdAt)}
        </span>
        {digest.emailedAt ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" aria-hidden />
              Emailed
            </span>
          </>
        ) : digest.emailError ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-warning">Not emailed: {digest.emailError}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <Link
          href={`/p/${project}/work?agentId=${digest.agent.id}`}
          className="text-accent hover:underline"
        >
          See the runs behind this
        </Link>
      </div>
    </Note>
  );
}

/**
 * Agents' digests: the short reports each writes on its own cadence, read
 * under Work beside the runs they sum up.
 */
export function DigestList({
  project,
  agentId,
  status,
}: {
  project: string;
  agentId: string;
  status: string;
}) {
  const { data, isPending, error, refetch, isRefetching } = useDigests({
    project,
    agentId,
    status: status === "unread" || status === "read" ? status : "all",
  });

  if (isPending) return <LoadingRows count={3} />;
  if (error) {
    return (
      <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} retrying={isRefetching} />
    );
  }
  if (data!.length === 0) {
    return status === "unread" ? (
      <EmptyState
        icon={CheckCircle2}
        title="You're up to date"
        description="Every update your agents have sent has been read. New ones arrive on each agent's digest cadence - weekly by default."
      />
    ) : status === "read" ? (
      <EmptyState icon={CheckCircle2} title="Nothing read yet" description="Digests move here once you have read them." />
    ) : (
      <EmptyState
        icon={Radio}
        title="No updates yet"
        description="Each agent writes you a short update on its own cadence - what it got done, what is pending, and anything it thinks you should know. Set the cadence in an agent's scope of work, or press Send one now there to see one immediately."
      />
    );
  }

  return (
    <div className="space-y-3">
      {status === "read" ? (
        <div className="flex justify-end">
          <RemoveButton
            targets={data!.map((digest) => ({ kind: "update" as const, id: digest.id }))}
            what={`${data!.length} digest${data!.length === 1 ? "" : "s"}`}
            label="Clear all"
          />
        </div>
      ) : null}
      {data!.map((digest) => (
        <DigestCard key={digest.id} digest={digest} project={project} />
      ))}
    </div>
  );
}
