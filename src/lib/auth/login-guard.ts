/**
 * What stands between the sign-in form and a password guesser:
 *
 * - Per address: 30 attempts every 15 minutes, whoever they are for, so one
 *   machine can't run through a list of accounts.
 * - Per account: 5 wrong passwords lock it for 15 minutes. Counted for any
 *   email typed, account or not, so a lock never reveals that an account
 *   exists. The owner is emailed once when it locks.
 * - After a good password: a sign-in from a browser and system the account
 *   hasn't used before is emailed to its owner, with where and when, and a
 *   reset link if it wasn't them.
 *
 * Built on the same rate-limit windows as the rest of the app.
 */
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";
import { checkRateLimit } from "@/lib/platform/rate-limit";
import { sendAppEmailLater } from "@/lib/platform/app-email";

const WINDOW_MS = 15 * 60_000;
const PER_ADDRESS = 30;
const PER_ACCOUNT = 5;
const failKey = (email: string) => `login-fail:${email}`;

/** The caller's address, from the proxy in front of the app. */
export function clientIp(request: Request | undefined): string {
  return (
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Seconds to wait when this attempt may not even be checked; null when it may. */
export async function signInBlocked(email: string, ip: string): Promise<number | null> {
  const perAddress = await checkRateLimit(`login-ip:${ip}`, PER_ADDRESS, WINDOW_MS);
  if (!perAddress.allowed) return perAddress.retryAfterSeconds;
  const row = await prisma.rateLimitWindow.findUnique({ where: { key: failKey(email) } });
  if (row && row.count >= PER_ACCOUNT && row.resetAt > new Date()) {
    return Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  }
  return null;
}

/** A wrong password: counts toward the lock, and tells the owner when it locks. */
export async function signInFailed(email: string, account: { email: string; firstName: string | null } | null) {
  const result = await checkRateLimit(failKey(email), PER_ACCOUNT, WINDOW_MS);
  if (account && result.remaining === 0) {
    sendAppEmailLater({
      to: account.email,
      subject: "Sign-in to your Desker account is paused",
      text: [
        `Hi${account.firstName ? ` ${account.firstName}` : ""},`,
        "",
        `Someone typed the wrong password for this account ${PER_ACCOUNT} times, so we've paused signing in to it for 15 minutes.`,
        "",
        "If it was you, wait a few minutes and try again - or reset your password:",
        `${env.appUrl || "https://personal.desker.dev"}/forgot-password`,
        "",
        "If it wasn't you, nothing has been changed and your password still works. Resetting it is the safe choice.",
      ].join("\n"),
    });
  }
}

export async function signInSucceeded(email: string) {
  await prisma.rateLimitWindow.deleteMany({ where: { key: failKey(email) } });
}

// --- new devices -------------------------------------------------------------------

interface KnownDevice {
  id: string;
  label: string;
  lastSeen: string;
}

/** "Chrome on macOS" - enough for a person to recognise, nothing more. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const system = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${system}`;
}

/** Where, roughly, from the hosting provider's own location headers. Never stored. */
function placeOf(request: Request | undefined): string | null {
  const city = request?.headers.get("x-vercel-ip-city");
  const region = request?.headers.get("x-vercel-ip-country-region");
  const country = request?.headers.get("x-vercel-ip-country");
  const parts = [city ? decodeURIComponent(city) : null, region, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Remembers the device and, when the account has signed in before but never
 * from this one, emails the owner. The very first sign-in only remembers.
 */
export async function noteDevice(
  user: { id: string; email: string; firstName: string | null; knownDevices: unknown },
  request: Request | undefined,
) {
  const label = deviceLabel(request?.headers.get("user-agent") ?? "");
  const id = createHash("sha256").update(label).digest("hex").slice(0, 16);
  const known = Array.isArray(user.knownDevices) ? (user.knownDevices as KnownDevice[]) : [];
  const now = new Date();
  const isNew = !known.some((device) => device.id === id);
  const next = [{ id, label, lastSeen: now.toISOString() }, ...known.filter((device) => device.id !== id)].slice(0, 10);
  await prisma.user.update({ where: { id: user.id }, data: { knownDevices: next as unknown as Prisma.InputJsonValue } });

  if (!isNew || known.length === 0) return;
  const place = placeOf(request);
  sendAppEmailLater({
    to: user.email,
    subject: `New sign-in to Desker: ${label}`,
    text: [
      `Hi${user.firstName ? ` ${user.firstName}` : ""},`,
      "",
      "Your Desker account was just signed in to from a device it hasn't used before:",
      "",
      `  ${label}`,
      ...(place ? [`  Near ${place}`] : []),
      `  ${now.toUTCString()}`,
      "",
      "If this was you, there's nothing to do.",
      "",
      "If it wasn't, reset your password now - that signs out every other session:",
      `${env.appUrl || "https://personal.desker.dev"}/forgot-password`,
    ].join("\n"),
  });
}
