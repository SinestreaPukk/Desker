/** Telegram bot webhook. Registered with a secret Telegram echoes back on every call. */
import { afterResponse } from "@/lib/after-response";
import { handleInbound } from "@/lib/messaging/inbound";
import { telegramSend } from "@/lib/messaging/send";
import { sameSecret } from "@/lib/messaging/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "")) {
    return new Response("Bad secret", { status: 401 });
  }
  const update = (await request.json()) as { message?: { chat?: { id?: number; type?: string }; text?: string; from?: { first_name?: string } } };
  const message = update.message;
  // Private chats only: a bot added to a group mustn't link the whole group.
  if (message?.chat?.id && message.chat.type === "private" && message.text) {
    const chatId = String(message.chat.id);
    const text = message.text.replace(/^\/start\s*/, "") || "help";
    afterResponse(async () => {
      await telegramSend(chatId, await handleInbound("telegram", chatId, text, message.from?.first_name));
    });
  }
  return new Response("ok");
}
