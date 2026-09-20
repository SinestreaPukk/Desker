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
import { env } from "@/lib/env";

export type NotificationKind = "escalation" | "critical_issue" | "handoff_reply";

export interface Notification {
  kind: NotificationKind;
  title: string;
  /** Plain-text body. Kept short - this lands in a chat channel. */
  body: string;
  agentName: string;
  conversationId: string;
  severity?: string | null;
}

function conversationUrl(conversationId: string): string | null {
  const base = env.appUrl;
  return base ? `${base}/inbox/${conversationId}` : null;
}

/** Slack incoming-webhook payload. Renders acceptably anywhere else too. */
function toPayload(notification: Notification) {
  const url = conversationUrl(notification.conversationId);
  const lines = [
    `*${notification.title}*`,
    notification.body,
    `_${notification.agentName}_${notification.severity ? ` · severity ${notification.severity}` : ""}`,
    url ? `<${url}|Open the conversation>` : null,
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
    conversationId: notification.conversationId,
    agentName: notification.agentName,
    severity: notification.severity ?? null,
    url,
  };
}

export async function notify(notification: Notification): Promise<void> {
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

/** Fire and forget, for call sites that must not wait. */
export function notifyInBackground(notification: Notification): void {
  void notify(notification);
}
