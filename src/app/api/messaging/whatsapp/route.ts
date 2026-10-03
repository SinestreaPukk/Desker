/** WhatsApp Cloud API webhook: Meta's verification handshake, then incoming messages. */
import { afterResponse } from "@/lib/platform/after-response";
import { handleInbound } from "@/lib/messaging/inbound";
import { whatsappSend } from "@/lib/messaging/send";
import { hmacMatches, sameSecret } from "@/lib/messaging/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && sameSecret(params.get("hub.verify_token"), process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "")) {
    return new Response(params.get("hub.challenge") ?? "");
  }
  return new Response("Forbidden", { status: 403 });
}

interface WhatsAppPayload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string } }[];
        messages?: { from: string; type: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

export async function POST(request: Request) {
  const body = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim() || "";
  if (!hmacMatches(body, secret, request.headers.get("x-hub-signature-256"), "hex", "sha256=")) {
    return new Response("Bad signature", { status: 401 });
  }
  const values = ((JSON.parse(body) as WhatsAppPayload).entry ?? []).flatMap((entry) => entry.changes ?? []).map((change) => change.value);
  afterResponse(async () => {
    for (const value of values) {
      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body) continue;
        await whatsappSend(message.from, await handleInbound("whatsapp", message.from, message.text.body, value?.contacts?.[0]?.profile?.name));
      }
    }
  });
  return new Response("ok");
}
