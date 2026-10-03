/**
 * "Forgot password": a one-time link by email, good for an hour.
 *
 * - Only a SHA-256 of the token is stored, so the database alone cannot reset
 *   anyone's password.
 * - Asking always answers the same way, whether or not an account exists, so
 *   the form cannot be used to find out who has one. The email goes out after
 *   the response for the same reason: no timing difference either.
 * - Using a link spends it and every other open link for that account, and
 *   stamps passwordChangedAt, which ends sessions signed in before it
 *   (auth.ts) - whoever knew the old password is signed out.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/platform/db";
import { audit } from "@/lib/platform/audit";
import { hashPassword } from "@/lib/auth/auth";
import { sendAppEmailLater } from "@/lib/platform/app-email";
import { checkRateLimit } from "@/lib/platform/rate-limit";

const TTL_MS = 60 * 60_000;
/** Reset emails per address per hour: enough for a typo, too few to flood an inbox. */
const PER_ADDRESS_PER_HOUR = 3;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(email: string, appUrl: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const limit = await checkRateLimit(`password-reset:${address}`, PER_ADDRESS_PER_HOUR, 60 * 60_000);
  if (!limit.allowed) return;

  const user = await prisma.user.findUnique({ where: { email: address }, select: { id: true, firstName: true } });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  sendAppEmailLater({
    to: address,
    subject: "Reset your Desker password",
    text:
      `${user.firstName ? `Hi ${user.firstName},` : "Hi,"}\n\n` +
      "Someone asked to reset the password for your Desker account. To choose a new one, open this link " +
      `within the next hour:\n\n${appUrl}/reset-password/${token}\n\n` +
      "If it wasn't you, ignore this email - your password stays as it is.",
  });
}

/** True when the link was valid and the password is now changed. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: digest(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return false;

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, passwordChangedAt: now } }),
    prisma.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  await audit({
    actorType: "user",
    actorId: reset.userId,
    action: "user.password_reset",
    targetType: "user",
    targetId: reset.userId,
  });
  return true;
}

/** Whether a reset link is still usable, so the page can say so before anyone types a password. */
export async function resetLinkUsable(token: string): Promise<boolean> {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: digest(token) },
    select: { expiresAt: true, usedAt: true },
  });
  return Boolean(reset && !reset.usedAt && reset.expiresAt > new Date());
}
