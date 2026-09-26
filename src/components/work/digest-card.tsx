"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RemoveButton } from "@/components/work/row-actions";
import { Panel } from "@/components/ui/panel";
import { useSetDigestRead } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { DigestDto } from "@/lib/work/serialize";
import type { DigestBulletKind } from "@/lib/work/types";
import { formatRelativeTime } from "@/lib/utils";

const BULLET: Record<
  DigestBulletKind,
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  heads_up: { icon: TriangleAlert, className: "text-warning", label: "Worth knowing" },
  pending: { icon: Clock, className: "text-accent", label: "Waiting on you" },
  done: { icon: CheckCircle2, className: "text-positive", label: "Done" },
};

/** "15 Sep – 22 Sep", or one date when the window is inside a day. */
function period(start: string, end: string): string {
  const from = new Date(start);
  const to = new Date(end);
  const day = { day: "numeric", month: "short" } as const;
  const sameDay = from.toDateString() === to.toDateString();
  return sameDay
    ? to.toLocaleDateString(undefined, day)
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
 * One update from one agent, as it lands in the Inbox. Unread is a left edge
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
    <Panel className={unread ? "border-l-2 border-l-accent" : undefined}>
      <div className="flex items-start gap-3 px-4 py-3">
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
            {unread ? <Badge tone="accent">New</Badge> : null}
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
        <span>{formatRelativeTime(digest.createdAt)}</span>
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
    </Panel>
  );
}
