import { z } from "zod";
import { handle, HttpError, parseJson, requireAdmin } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { composeBrief, composeNews } from "@/lib/messaging/brief";
import { messageUser } from "@/lib/messaging/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Send me one now": the brief or the news, to every channel that's on. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { what } = await parseJson(request, z.object({ what: z.enum(["brief", "news"]) }));
    const limit = await checkRateLimit(`alert-send:${userId}`, 10, 60 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "That's a lot for one hour. Try again later.");
    const message = what === "brief" ? await composeBrief(userId) : await composeNews(userId);
    const sent = await messageUser(userId, message, { force: true });
    if (sent === 0) throw new HttpError(400, "Nothing arrived. Add a place to send it, and check it's turned on.");
    return { sent };
  });
}
