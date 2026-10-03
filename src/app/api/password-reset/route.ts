import { handle, parseJson, HttpError } from "@/lib/platform/api";
import { env } from "@/lib/platform/env";
import { checkRateLimit } from "@/lib/platform/rate-limit";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { passwordResetRequestSchema } from "@/lib/shared/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Forgot password". Always the same answer, account or not (password-reset.ts). */
export async function POST(request: Request) {
  return handle(async () => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const limit = await checkRateLimit(`password-reset-ip:${ip}`, 10, 10 * 60_000);
    if (!limit.allowed) throw new HttpError(429, `Too many requests. Try again in ${limit.retryAfterSeconds}s.`);
    const { email } = await parseJson(request, passwordResetRequestSchema);
    await requestPasswordReset(email, env.appUrl || new URL(request.url).origin);
    return { ok: true };
  });
}
