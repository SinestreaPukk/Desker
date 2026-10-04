import bcrypt from "bcryptjs";
import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { hashPassword } from "@/lib/auth/auth";
import { passwordProblem } from "@/lib/auth/password-check";
import { checkRateLimit } from "@/lib/platform/rate-limit";
import { audit } from "@/lib/platform/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ current: z.string().max(200), next: z.string().min(8, "Use at least 8 characters.").max(200) });

/** Change the password. Every session signed in before now ends, this one included. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const limit = await checkRateLimit(`password-change:${userId}`, 5, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, `Too many tries. Wait ${limit.retryAfterSeconds}s.`);
    const { current, next } = await parseJson(request, schema);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      throw new HttpError(400, "That isn't your current password.", { fieldErrors: { current: ["That isn't your current password."] } });
    }
    const weak = await passwordProblem(next, email);
    if (weak) throw new HttpError(422, weak, { fieldErrors: { next: [weak] } });
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
    await audit({ actorType: "user", actorId: userId, action: "user.password_changed", targetType: "user", targetId: userId });
    return { ok: true };
  });
}
