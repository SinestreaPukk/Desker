import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyInBackground } from "@/lib/notify";
import { SITE } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Say a little more.").max(4000),
  website: z.string().max(200).optional().or(z.literal("")),
});

/**
 * The contact form. The message is always kept (as feedback of kind
 * "contact") and forwarded to the notification webhook; it is emailed too
 * when the deployment has Resend and a CONTACT_EMAIL. A filled honeypot is
 * accepted and dropped, so a bot learns nothing.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = checkRateLimit(`contact:${ip}`, 5, 10 * 60_000);
    if (!limit.allowed) throw new HttpError(429, `Too many messages from this address. Try again in ${limit.retryAfterSeconds}s.`);

    const input = await parseJson(request, schema);
    if (input.website) return { ok: true };

    const body = [
      `From: ${input.name} <${input.email}>`,
      input.company ? `Company: ${input.company}` : null,
      "",
      input.message,
    ]
      .filter((line) => line !== null)
      .join("\n");

    await prisma.feedback.create({
      data: {
        kind: "contact",
        message: body,
        path: "/contact",
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    notifyInBackground({
      kind: "feedback",
      title: `Contact form: ${input.name}`,
      body: body.slice(0, 1500),
      agentName: SITE.company.name,
      path: "/contact",
    });

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const to = process.env.CONTACT_EMAIL?.trim() || SITE.company.email;
    if (apiKey && from) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: input.email,
          subject: `[${SITE.company.name}] Contact from ${input.name}${input.company ? ` (${input.company})` : ""}`,
          text: body,
        }),
      }).catch((error: unknown) => console.error("[contact] email failed", error));
    }
    return { ok: true };
  });
}
