/**
 * LIFF: pages that open inside LINE. The page has no cookie, so it sends the
 * LINE ID token; we verify it with LINE (audience = our LINE Login channel)
 * and map the LINE user to their Desker account through the same link made
 * when they connected LINE in Alerts. No token, or a person who never linked,
 * gets nothing.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { senderKey } from "./send";

export async function liffUser(request: Request): Promise<string | null> {
  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  if (!idToken || !clientId) return null;
  const r = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const sub = ((await r.json().catch(() => ({}))) as { sub?: string }).sub;
  if (!sub) return null;
  const channel = await prisma.messageChannel.findUnique({ where: { senderKey: senderKey("line", sub) }, select: { userId: true } });
  return channel?.userId ?? null;
}
