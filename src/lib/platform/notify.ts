/**
 * Outbound notifications for things that need a person.
 *
 * An escalation nobody sees for six hours is not an escalation, so the moments
 * that need attention are pushed out rather than waiting to be noticed in the
 * dashboard.
 *
 * Transport is a webhook: Slack's incoming-webhook format is the default
 * because it needs no dependency, no credentials beyond the URL, and every
 * other destination (Teams, Discord, a relay that sends email) accepts the same
 * POST. Sending is best-effort and never blocks or fails the request that
 * triggered it - a broken webhook must not break a client's chat.
 */
import "server-only";
import { afterResponse } from "@/lib/platform/after-response";
import { env } from "@/lib/platform/env";
import { prisma } from "@/lib/platform/db";
import { previewPending } from "@/lib/work/pending-preview";
import type { PendingAction } from "@/lib/work/types";
import { messageOrganization } from "@/lib/messaging/send";
import type { EventKind } from "@/lib/messaging/prefs";

type NotificationKind =
  | "escalation"
  | "critical_issue"
  | "handoff_reply"
  | "run_failed"
  | "approval_waiting"
  | "feedback"
  | "work_done"
  | "digest";

/** Which of a person's alert settings each kind falls under. */
const EVENT_OF: Record<NotificationKind, EventKind> = {
  escalation: "escalation",
  handoff_reply: "escalation",
  critical_issue: "issue",
  feedback: "issue",
  run_failed: "failure",
  approval_waiting: "approval",
  work_done: "done",
  digest: "digest",
};

interface Notification {
  kind: NotificationKind;
  title: string;
  /** Plain-text body. Kept short - this lands in a chat channel. */
  body: string;
  agentName: string;
  /** What the "open" link should point at. */
  path?: string;
  severity?: string | null;
  /** For an approval: the waiting action, so LINE can show exactly what it will do and offer Approve / Not now. */
  actionItemId?: string;
  /** Whose space it happened in: its people get it in the apps they chose under Alerts. */
  organizationId?: string;
  /** Routine news for the space's people only, not the operators' webhooks. */
  peopleOnly?: boolean;
}

function linkFor(notification: Notification): string | null {
  const base = env.appUrl;
  if (!base) return null;
  if (notification.path) return `${base}${notification.path}`;
  return null;
}

/** Slack incoming-webhook payload. Renders acceptably anywhere else too. */
function toPayload(notification: Notification) {
  const url = linkFor(notification);
  const lines = [
    `*${notification.title}*`,
    notification.body,
    `_${notification.agentName}_${notification.severity ? ` · severity ${notification.severity}` : ""}`,
    url ? `<${url}|Open in Desker>` : null,
  ].filter(Boolean);

  return {
    text: `${notification.title} — ${notification.agentName}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
    ],
    // Everything a non-Slack consumer needs, so a generic relay does not have
    // to parse the blocks above.
    kind: notification.kind,
    agentName: notification.agentName,
    severity: notification.severity ?? null,
    url,
  };
}

async function approvalOf(notification: Notification) {
  if (notification.kind !== "approval_waiting" || !notification.actionItemId) return undefined;
  const item = await prisma.actionItem.findUnique({ where: { id: notification.actionItemId }, select: { pendingAction: true, status: true, agent: { select: { scopeOfWork: { select: { timezone: true } } } } } });
  const pending = item?.status === "needs_approval" ? (item.pendingAction as PendingAction | null) : null;
  if (!pending) return undefined;
  const draft = pending.draftId ? await prisma.draft.findUnique({ where: { id: pending.draftId }, select: { title: true, body: true } }) : null;
  return { actionItemId: notification.actionItemId, agent: notification.agentName, ...previewPending(pending, draft, item?.agent.scopeOfWork?.timezone) };
}

async function notify(notification: Notification): Promise<void> {
  const approval = await approvalOf(notification).catch(() => undefined);
  await Promise.all([
    notification.peopleOnly ? null : notifyOperators(notification),
    notification.organizationId
      ? messageOrganization(notification.organizationId, EVENT_OF[notification.kind], {
          title: notification.title,
          body: `${notification.body}\n\n${notification.agentName}`,
          url: linkFor(notification),
          approval,
        }).catch((error: unknown) => console.error("[notify] messaging failed:", error))
      : null,
  ]);
}

/** The deployment's own webhooks (NOTIFY_WEBHOOK_URLS), for whoever runs it. */
async function notifyOperators(notification: Notification): Promise<void> {
  const targets = env.notifyWebhooks;
  if (targets.length === 0) return;

  const payload = JSON.stringify(toPayload(notification));

  await Promise.all(
    targets.map(async (target) => {
      try {
        const response = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          // A slow webhook must not hold a chat turn open.
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          console.error(
            `[notify] ${new URL(target).host} returned ${response.status}`,
          );
        }
      } catch (error) {
        console.error(
          "[notify] delivery failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
}

/**
 * Fire and forget, for call sites that must not wait.
 *
 * Handed to the runtime rather than left as a floating promise: a route
 * handler that returns before the webhook resolves can have its invocation
 * frozen, and the notification never leaves. See afterResponse.
 */
export function notifyInBackground(notification: Notification): void {
  afterResponse(() => notify(notification));
}
