/**
 * Email Desker itself sends - not an agent's: password resets, invitations,
 * and contact-form messages and feedback for whoever runs the deployment.
 * Goes through the deployment's Resend account (RESEND_API_KEY and
 * EMAIL_FROM). Without those nothing is sent, and the log says so; the
 * callers keep working, because none of these may block the action itself.
 */
import "server-only";
import { afterResponse } from "@/lib/after-response";
import { SITE } from "@/lib/content";

interface AppEmail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/** Sends now and says whether it went. */
export async function deliverAppEmail(message: AppEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(`[app-email] not sent (RESEND_API_KEY / EMAIL_FROM not set): ${message.subject}`);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [message.to],
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // A rejected send - an unverified sending domain is the usual one -
    // answers 4xx; read it as the failure it is.
    if (!response.ok) {
      console.error(`[app-email] rejected: ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    }
    return response.ok;
  } catch (error: unknown) {
    console.error("[app-email] failed", error);
    return false;
  }
}

/** Sends after the response, so a slow provider never holds a form open or tells a timing story. */
export function sendAppEmailLater(message: AppEmail): void {
  afterResponse(async () => {
    await deliverAppEmail(message);
  });
}

/** To whoever runs this deployment: CONTACT_EMAIL, or the company email in content/site.json. */
export function emailOwner(message: Omit<AppEmail, "to">): void {
  sendAppEmailLater({
    ...message,
    to: process.env.CONTACT_EMAIL?.trim() || SITE.company.email,
    subject: `[${SITE.company.name}] ${message.subject}`,
  });
}
