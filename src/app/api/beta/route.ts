import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailOwner } from "@/lib/app-email";
import { FIRST_HIRES } from "@/lib/beta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  firstHire: z.enum(FIRST_HIRES).optional().or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
});

/**
 * The beta list. Kept as feedback of kind "beta" (so nothing is lost if the
 * email fails) and emailed to the owner, who sends the invites. A filled
 * honeypot is accepted and dropped, as on the contact form.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = await checkRateLimit(`beta:${ip}`, 5, 10 * 60_000);
    if (!limit.allowed) throw new HttpError(429, `Too many requests from this address. Try again in ${limit.retryAfterSeconds}s.`);

    const input = await parseJson(request, schema);
    if (input.website) return { ok: true };

    const body = [`Email: ${input.email}`, `Would hire first: ${input.firstHire || "not sure yet"}`].join("\n");
    await prisma.feedback.create({
      data: {
        kind: "beta",
        message: body,
        path: "/beta",
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    emailOwner({ subject: `Beta request from ${input.email}`, text: body, replyTo: input.email });
    return { ok: true };
  });
}
