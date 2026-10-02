/**
 * What a recurring email from Desker (a digest or check-in) carries: who it is
 * from and a way to stop receiving it that works in one step and is honoured.
 *
 * The unsubscribe link is signed, so it cannot be forged for someone else.
 * An email to one person carries a link for that address - one click, done.
 * An email to several carries a link for the organisation, and the page asks
 * which address to take off.
 *
 * Opt-outs are per organisation (EmailSuppression) and checked before every
 * agent email and every digest.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

interface OptOut {
  organizationId: string;
  email: string | null;
}

function key(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return `email-optout:${secret}`;
}

export function optOutToken(organizationId: string, email: string | null): string {
  const body = Buffer.from(JSON.stringify({ o: organizationId, e: email?.toLowerCase() ?? null })).toString("base64url");
  return `${body}.${createHmac("sha256", key()).update(body).digest("base64url")}`;
}

/** Null for anything tampered with. Links never expire: an old email must still unsubscribe. */
export function readOptOutToken(token: string): OptOut | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { o?: unknown; e?: unknown };
    if (typeof parsed.o !== "string") return null;
    return { organizationId: parsed.o, email: typeof parsed.e === "string" ? parsed.e : null };
  } catch {
    return null;
  }
}

export async function suppress(organizationId: string, email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  await prisma.emailSuppression.upsert({
    where: { organizationId_email: { organizationId, email: address } },
    create: { organizationId, email: address },
    update: {},
  });
}

/** The recipients still willing to hear from this organisation, and those who opted out. */
export async function splitOptedOut(
  organizationId: string,
  recipients: readonly string[],
): Promise<{ allowed: string[]; optedOut: string[] }> {
  const rows = await prisma.emailSuppression.findMany({
    where: { organizationId, email: { in: recipients.map((r) => r.trim().toLowerCase()) } },
    select: { email: true },
  });
  const blocked = new Set(rows.map((row) => row.email));
  return {
    allowed: recipients.filter((r) => !blocked.has(r.trim().toLowerCase())),
    optedOut: recipients.filter((r) => blocked.has(r.trim().toLowerCase())),
  };
}

/**
 * The footer and headers for one send. `pageUrl` is the page a person opens;
 * `oneClickUrl` is what mail apps POST to from their own Unsubscribe button
 * (RFC 8058). Both are null when the deployment does not know its own URL.
 */
export function optOutFor(
  organization: { id: string; name: string },
  recipients: readonly string[],
): { footer: string; headers: Record<string, string> } {
  const token = optOutToken(organization.id, recipients.length === 1 ? recipients[0]! : null);
  const pageUrl = env.appUrl ? `${env.appUrl}/unsubscribe/${token}` : null;
  const oneClickUrl = env.appUrl && recipients.length === 1 ? `${env.appUrl}/api/unsubscribe/${token}` : null;
  const lines = [
    "--",
    `Sent by ${organization.name}.`,
    pageUrl
      ? `To stop receiving emails from ${organization.name}: ${pageUrl}`
      : `To stop receiving emails from ${organization.name}, reply with "unsubscribe".`,
  ];
  return {
    footer: `\n\n${lines.join("\n")}`,
    headers: oneClickUrl
      ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : {},
  };
}
