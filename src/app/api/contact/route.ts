import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestLooksAutomated } from "@/lib/bot-check";
import { notifyInBackground } from "@/lib/notify";
import { SITE } from "@/lib/content";
import { emailOwner } from "@/lib/app-email";

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
 * "contact"), forwarded to the notification webhook, and emailed to the
 * owner (app-email.ts). A filled honeypot is
 * accepted and dropped, so a bot learns nothing.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = await checkRateLimit(`contact:${ip}`, 5, 10 * 60_000);
    if (!limit.allowed) throw new HttpError(429, `Too many messages from this address. Try again in ${limit.retryAfterSeconds}s.`);

    // A bot is thanked like anyone else, so it learns nothing.
    if (await requestLooksAutomated(request)) return { ok: true };
    const input = await parseJson(request, schema);

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

    emailOwner({
      subject: `Contact from ${input.name}${input.company ? ` (${input.company})` : ""}`,
      text: body,
      replyTo: input.email,
    });
    return { ok: true };
  });
}
