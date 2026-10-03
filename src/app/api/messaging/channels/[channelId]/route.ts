import { z } from "zod";
import { handle, HttpError, parseJson, requireAdmin } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { checkRateLimit } from "@/lib/platform/rate-limit";
import { sendToChannel } from "@/lib/messaging/send";
import { alertSettings } from "@/lib/messaging/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ channelId: string }> };

async function ownChannel(channelId: string, userId: string) {
  const channel = await prisma.messageChannel.findFirst({ where: { id: channelId, userId } });
  if (!channel) throw new HttpError(404, "That channel isn't on your list.");
  return channel;
}

/** Turn it on or off. */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const channel = await ownChannel((await params).channelId, userId);
    const { enabled } = await parseJson(request, z.object({ enabled: z.boolean() }));
    await prisma.messageChannel.update({ where: { id: channel.id }, data: { enabled } });
    return alertSettings(userId);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const channel = await ownChannel((await params).channelId, userId);
    await prisma.messageChannel.delete({ where: { id: channel.id } });
    return alertSettings(userId);
  });
}

/** Send a test message. */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const channel = await ownChannel((await params).channelId, userId);
    const limit = await checkRateLimit(`alert-test:${userId}`, 10, 60 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "That's a lot of tests. Try again in a while.");
    const result = await sendToChannel(channel, {
      title: "Test from Desker",
      body: "This is where your alerts and morning brief will arrive.",
    });
    if (!result.ok) throw new HttpError(502, `It didn't arrive: ${result.detail}`);
    return alertSettings(userId);
  });
}
