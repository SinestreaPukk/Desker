/**
 * Error monitoring, in one place. Sentry when a DSN is configured; the
 * console otherwise. Nothing else imports @sentry/* directly, so the
 * dependency can be swapped or removed without touching features.
 *
 * Every capture carries the organisation and, where there is one, the agent
 * and action item - the three keys that let a report be traced to what a
 * customer actually saw.
 */
import * as Sentry from "@sentry/nextjs";

export function monitoringEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}

export interface ErrorContext {
  organizationId?: string | null;
  agentId?: string | null;
  actionItemId?: string | null;
  route?: string;
  [key: string]: unknown;
}

export function captureError(error: unknown, context: ErrorContext = {}): void {
  if (monitoringEnabled()) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && value !== null) scope.setTag(key, String(value));
      }
      Sentry.captureException(error);
    });
  }
  console.error("[monitoring]", context.route ?? "", error);
}

export function captureMessage(message: string, context: ErrorContext = {}): void {
  if (monitoringEnabled()) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && value !== null) scope.setTag(key, String(value));
      }
      Sentry.captureMessage(message, "warning");
    });
  }
  console.warn("[monitoring]", message, context);
}

/**
 * A cron monitor: Sentry expects a check-in on the schedule and alerts when
 * one is missed - which is how a dead scheduler becomes a page rather than
 * a support ticket. A no-op without a DSN.
 */
export function withCronMonitor<T>(
  slug: string,
  cron: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!monitoringEnabled()) return run();
  return Sentry.withMonitor(slug, run, {
    schedule: { type: "crontab", value: cron },
    checkinMargin: 2,
    maxRuntime: 10,
    timezone: "UTC",
  });
}
