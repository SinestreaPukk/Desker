/**
 * Browser-side Sentry, loaded after the page has painted.
 *
 * The SDK is ~200 KB of script; on a page whose whole job is the first
 * second, that is not critical-path code. Errors thrown during that window
 * are rare and the server side captures its own, so the trade is deliberate:
 * the SDK arrives on the `load` event, and anything before it is uncaught.
 */
import { scrubDeep } from "@/lib/platform/scrub";

type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | null = null;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn && typeof window !== "undefined") {
  const start = () =>
    void import("@sentry/nextjs").then((mod) => {
      mod.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "production",
        tracesSampleRate: 0.05,
        sendDefaultPii: false,
        // Reset-link tokens, OAuth codes and keys never leave in a report.
        beforeSend: (event) => scrubDeep(event),
        beforeSendTransaction: (event) => scrubDeep(event),
        beforeBreadcrumb: (crumb) => scrubDeep(crumb),
      });
      sentry = mod;
    });
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

export const onRouterTransitionStart: SentryModule["captureRouterTransitionStart"] = (...args) => {
  sentry?.captureRouterTransitionStart(...args);
};
