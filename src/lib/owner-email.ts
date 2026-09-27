/**
 * Emails whoever runs this Desker deployment: contact-form messages and
 * in-app feedback. Goes to CONTACT_EMAIL, or the company email in
 * content/site.json, through the deployment's Resend account (RESEND_API_KEY
 * and EMAIL_FROM). Without those the message is still stored - it is only the
 * email that is skipped, and the log says so.
 *
 * Sent after the response, so a slow provider never holds a form open.
 */
import "server-only";
import { afterResponse } from "@/lib/after-response";
import { SITE } from "@/lib/content";

export function emailOwner(message: { subject: string; text: string; replyTo?: string }): void {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = process.env.CONTACT_EMAIL?.trim() || SITE.company.email;
  if (!apiKey || !from) {
    console.warn(`[owner-email] not sent (RESEND_API_KEY / EMAIL_FROM not set): ${message.subject}`);
    return;
  }
  afterResponse(async () => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: [to],
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          subject: `[${SITE.company.name}] ${message.subject}`,
          text: message.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      // A rejected send - an unverified sending domain is the usual one -
      // answers 4xx; read it as the failure it is.
      if (!response.ok) {
        console.error(`[owner-email] rejected: ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
      }
    } catch (error: unknown) {
      console.error("[owner-email] failed", error);
    }
  });
}
