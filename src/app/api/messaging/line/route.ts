/** LINE Messaging API webhook: link codes, commands, slip photos, approval taps and chat. */
import { afterResponse } from "@/lib/after-response";
import { handleLineEvent, type LineEvent } from "@/lib/messaging/line-handler";
import { hmacMatches } from "@/lib/messaging/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  if (!hmacMatches(body, process.env.LINE_CHANNEL_SECRET?.trim() ?? "", request.headers.get("x-line-signature"), "base64")) {
    return new Response("Bad signature", { status: 401 });
  }
  const events = (JSON.parse(body) as { events?: LineEvent[] }).events ?? [];
  // Acknowledged at once; each event is worked on after the response, so a slow model never times the webhook out.
  afterResponse(async () => {
    for (const event of events) await handleLineEvent(event);
  });
  return new Response("ok");
}
