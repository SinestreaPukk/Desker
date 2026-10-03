import { randomInt } from "node:crypto";
import { z } from "zod";
import { handle, HttpError, parseJson, requireAdmin } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { seal } from "@/lib/auth/vault";
import { CHANNEL_KINDS, CHANNELS, webhookAllowed } from "@/lib/messaging/prefs";
import { channelAvailable } from "@/lib/messaging/send";
import { alertSettings } from "@/lib/messaging/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(CHANNEL_KINDS),
  url: z.string().trim().max(1000).optional(),
  name: z.string().trim().max(60).optional(),
});

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");

/** Add a place to get messages. A chat app starts unlinked, with a code to send it. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const input = await parseJson(request, schema);
    const { name, how } = CHANNELS[input.kind];
    if (!channelAvailable(input.kind)) throw new HttpError(400, `${name} isn't set up on this server yet.`);
    if ((await prisma.messageChannel.count({ where: { userId } })) >= 10) throw new HttpError(400, "That's 10 already. Remove one first.");

    if (how === "chat") {
      // One code at a time per app: a fresh one replaces an unused one.
      await prisma.messageChannel.deleteMany({ where: { userId, kind: input.kind, target: null } });
      await prisma.messageChannel.create({ data: { userId, kind: input.kind, label: `${name} (waiting for your code)`, linkCode: newCode() } });
    } else if (how === "email") {
      if (await prisma.messageChannel.findFirst({ where: { userId, kind: "email" } })) throw new HttpError(400, "Email is already on your list.");
      await prisma.messageChannel.create({ data: { userId, kind: "email", label: `Email · ${email}`, target: seal(email) } });
    } else {
      if (!input.url || !webhookAllowed(input.kind, input.url)) {
        throw new HttpError(400, `That isn't a ${name} webhook URL.`, { fieldErrors: { url: [`Paste the webhook URL ${name} gave you.`] } });
      }
      await prisma.messageChannel.create({
        data: { userId, kind: input.kind, label: input.name ? `${name} · ${input.name}` : name, target: seal(input.url) },
      });
    }
    return alertSettings(userId);
  });
}
