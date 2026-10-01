/**
 * What someone sends our LINE, Telegram or WhatsApp account: the code that
 * links the chat to their Desker account, or a command - "brief", "news",
 * "pause", "resume". Returns the reply; each webhook sends it its own way.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { seal } from "@/lib/vault";
import { composeBrief, composeNews } from "./brief";
import { LINK_CODE, parseCommand, readPrefs, CHANNELS, type ChannelKind } from "./prefs";
import { plainText, senderKey } from "./send";

const HELP = `Send:
• brief - your morning brief now
• news - news on your topics
• pause - stop all messages
• resume - start them again
Change what you get under Alerts in Desker.`;

/** A link code works for an hour. */
const CODE_TTL_MS = 60 * 60_000;

const NOT_LINKED = "Hi! To get Desker's messages here, open Alerts in Desker, choose this app, and send the code it shows you.";

export async function handleInbound(kind: ChannelKind, chatId: string, text: string, displayName?: string): Promise<string> {
  const key = senderKey(kind, chatId);
  const command = parseCommand(text);

  if (!command) {
    // "Desker AB3K7Q" is what the link types; "DESKER" itself would pass for a code.
    const code = text.toUpperCase().replace(/DESKER/g, " ").match(LINK_CODE)?.[1];
    const pending = code ? await prisma.messageChannel.findFirst({ where: { linkCode: code, kind, createdAt: { gt: new Date(Date.now() - CODE_TTL_MS) } } }) : null;
    if (pending) {
      // One Desker account per chat: linking again moves it here.
      await prisma.messageChannel.deleteMany({ where: { senderKey: key, id: { not: pending.id } } });
      try {
        await prisma.messageChannel.update({
          where: { id: pending.id },
          data: {
            target: seal(chatId),
            senderKey: key,
            linkCode: null,
            label: displayName ? `${CHANNELS[kind].name} · ${displayName}` : CHANNELS[kind].name,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "This chat is already linked.";
        throw error;
      }
      return `Connected. Desker will message you here.\n\n${HELP}`;
    }
  }

  const channel = await prisma.messageChannel.findUnique({ where: { senderKey: key }, select: { userId: true } });
  if (!channel) return NOT_LINKED;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: channel.userId }, select: { alertPrefs: true } });
  const prefs = readPrefs(user.alertPrefs);

  switch (command) {
    case "brief":
      return plainText(await composeBrief(channel.userId));
    case "news":
      return plainText(await composeNews(channel.userId));
    case "pause":
    case "resume":
      await prisma.user.update({
        where: { id: channel.userId },
        data: { alertPrefs: { ...prefs, paused: command === "pause" } as Prisma.InputJsonValue },
      });
      return command === "pause" ? "Paused. Send \"resume\" to start again." : "Back on. You'll get your alerts and brief again.";
    default:
      return HELP;
  }
}
