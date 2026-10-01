import * as Sentry from "@sentry/nextjs";
import { scrubDeep } from "@/lib/scrub";

/** Server and edge runtimes: initialise Sentry once per runtime. */
export async function register() {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0.1,
    // Never ship request bodies or headers: they can contain client messages
    // and integration secrets.
    sendDefaultPii: false,
    // And strip what is left that could be a secret: tokens in addresses,
    // keys and bearer tokens in error text.
    beforeSend: (event) => scrubDeep(event),
    beforeSendTransaction: (event) => scrubDeep(event),
    beforeBreadcrumb: (crumb) => scrubDeep(crumb),
  });
}

/** Errors Next.js itself catches while rendering or handling a request. */
export const onRequestError = Sentry.captureRequestError;
