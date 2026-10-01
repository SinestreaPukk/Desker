/** LINE Messaging API webhook: link codes and commands from people who added our account. */
import { afterResponse } from "@/lib/after-response";
import { handleInbound } from "@/lib/messaging/inbound";
import { lineReply } from "@/lib/messaging/send";
import { hmacMatches } from "@/lib/messaging/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!hmacMatches(body, process.env.LINE_CHANNEL_SECRET?.trim() ?? "", request.headers.get("x-line-signature"), "base64")) {
    return new Response("Bad signature", { status: 401 });
  }
  const events = (JSON.parse(body) as { events?: LineEvent[] }).events ?? [];
  afterResponse(async () => {
    for (const event of events) {
      const userId = event.source?.userId;
      if (!userId || !event.replyToken) continue;
      // Adding the account as a friend says hello; a text is a code or a command.
      const text = event.type === "follow" ? "help" : event.type === "message" && event.message?.type === "text" ? event.message.text : null;
      if (!text) continue;
      await lineReply(event.replyToken, await handleInbound("line", userId, text));
    }
  });
  return new Response("ok");
}
