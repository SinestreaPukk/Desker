/**
 * Sending a person Desker's messages in the app they chose. One plain-text
 * message shape for every platform; each sender only adapts the envelope.
 * Best-effort: a dead webhook is noted on the channel, never thrown at the
 * work that triggered it.
 */
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/platform/db";
import { deliverAppEmail } from "@/lib/platform/app-email";
import { open } from "@/lib/auth/vault";
import { approvalFlex, linePush, replyMessages, text as lineText } from "./line";
import { CHANNELS, readPrefs, type ChannelKind, type EventKind } from "./prefs";

export interface OutboundMessage {
  title: string;
  body: string;
  url?: string | null;
  /** A consequential action waiting for a yes: LINE shows exactly what it will do, with Approve / Not now buttons. */
  /** The reply as the chat shows it, screenshots included: LINE sends the pictures too, other apps get title and body. */
  markdown?: string;
  approval?: { actionItemId: string; verb: string; lines: string[]; agent: string };
}

const env = (name: string) => process.env[name]?.trim() || "";

/** Whether this deployment has the keys a channel needs. Webhook channels need none. */
export function channelAvailable(kind: ChannelKind): boolean {
  switch (kind) {
    case "line":
      return Boolean(env("LINE_CHANNEL_ACCESS_TOKEN") && env("LINE_CHANNEL_SECRET") && env("LINE_BOT_ID"));
    case "telegram":
      return Boolean(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_BOT_USERNAME") && env("TELEGRAM_WEBHOOK_SECRET"));
    case "whatsapp":
      return Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_NUMBER") && env("WHATSAPP_VERIFY_TOKEN"));
    case "email":
      return Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));
    default:
      return Boolean(env("VAULT_KEY"));
  }
}

/** The tap that opens the app with the link code already typed. */
export function linkUrl(kind: ChannelKind, code: string): string | null {
  const text = encodeURIComponent(`Desker ${code}`);
  if (kind === "line") return `https://line.me/R/oaMessage/${encodeURIComponent(env("LINE_BOT_ID"))}/?${text}`;
  if (kind === "telegram") return `https://t.me/${env("TELEGRAM_BOT_USERNAME")}?start=${code}`;
  if (kind === "whatsapp") return `https://wa.me/${env("WHATSAPP_NUMBER").replace(/\D/g, "")}?text=${text}`;
  return null;
}

/** How people find our account in the app by hand: "@056qtobu", "@DeskerBot", "+66 …". */
export function appHandle(kind: ChannelKind): string | null {
  if (kind === "line") return env("LINE_BOT_ID") || null;
  if (kind === "telegram") return env("TELEGRAM_BOT_USERNAME") ? `@${env("TELEGRAM_BOT_USERNAME")}` : null;
  if (kind === "whatsapp") return env("WHATSAPP_NUMBER") || null;
  return null;
}

/** Recognises who a chat message is from without storing their chat id in the clear. */
export function senderKey(kind: ChannelKind, chatId: string): string {
  return createHash("sha256").update(`${kind}:${chatId}`).digest("hex");
}

export function plainText(message: OutboundMessage, limit = 3500): string {
  const text = [message.title, message.body.trim(), message.url ?? ""].filter(Boolean).join("\n\n");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

type Result = { ok: true } | { ok: false; detail: string };

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Result> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return { ok: true };
    return { ok: false, detail: `${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Couldn't reach it." };
  }
}

export function telegramSend(chatId: string, text: string): Promise<Result> {
  return post(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    chat_id: chatId,
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
  });
}

export async function whatsappSend(phone: string, text: string): Promise<Result> {
  const url = `https://graph.facebook.com/v23.0/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`;
  const auth = { authorization: `Bearer ${env("WHATSAPP_TOKEN")}` };
  const sent = await post(url, { messaging_product: "whatsapp", to: phone, type: "text", text: { body: text.slice(0, 4000), preview_url: false } }, auth);
  const template = env("WHATSAPP_TEMPLATE");
  // WhatsApp only lets a business start a conversation with an approved
  // template; a plain message works for 24 hours after the person last wrote.
  if (sent.ok || !template || !/131047|re-engagement/i.test(sent.detail)) return sent;
  return post(
    url,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: template,
        language: { code: env("WHATSAPP_TEMPLATE_LANG") || "en" },
        // Template values can't hold line breaks.
        components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s*\n+\s*/g, " · ").slice(0, 900) }] }],
      },
    },
    auth,
  );
}

async function deliver(kind: ChannelKind, target: string, message: OutboundMessage): Promise<Result> {
  const text = plainText(message);
  switch (kind) {
    case "line": {
      const a = message.approval;
      return linePush(target, a ? [approvalFlex({ ...a, actionItemId: a.actionItemId, url: message.url })] : message.markdown ? replyMessages(message.markdown) : [lineText(text)]);
    }
    case "telegram":
      return telegramSend(target, text);
    case "whatsapp":
      return whatsappSend(target, text);
    case "email": {
      const ok = await deliverAppEmail({
        to: target,
        subject: message.title,
        text: `${message.body}${message.url ? `\n\nOpen in Desker: ${message.url}` : ""}\n\nTo change what Desker sends you, open Alerts in Desker.`,
      });
      return ok ? { ok: true } : { ok: false, detail: "The email didn't send." };
    }
    case "slack":
      return post(target, { text: message.url ? `${plainText({ ...message, url: null })}\n<${message.url}|Open in Desker>` : text });
    case "discord":
      return post(target, { content: plainText(message, 1900), allowed_mentions: { parse: [] } });
    case "teams":
      return post(target, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                { type: "TextBlock", text: message.title, weight: "Bolder", wrap: true },
                { type: "TextBlock", text: message.body, wrap: true },
              ],
              actions: message.url ? [{ type: "Action.OpenUrl", title: "Open in Desker", url: message.url }] : [],
            },
          },
        ],
      });
  }
}

/** One channel, recording whether it arrived. */
export async function sendToChannel(
  channel: { id: string; kind: string; target: string | null },
  message: OutboundMessage,
): Promise<Result> {
  if (!channel.target || !(channel.kind in CHANNELS)) return { ok: false, detail: "Not linked yet." };
  const kind = channel.kind as ChannelKind;
  const result = channelAvailable(kind)
    ? await deliver(kind, open<string>(channel.target), message).catch((error: unknown) => ({
        ok: false as const,
        detail: error instanceof Error ? error.message : "Failed.",
      }))
    : { ok: false as const, detail: `${CHANNELS[kind].name} isn't set up on this server.` };
  await prisma.messageChannel
    .update({ where: { id: channel.id }, data: { lastError: result.ok ? null : result.detail.slice(0, 300) } })
    .catch(() => {});
  if (!result.ok) console.error(`[messaging] ${kind} failed: ${result.detail}`);
  return result;
}

/**
 * Everywhere this person gets messages, if they want this kind of message.
 * `event` absent means they asked for it (a brief, a test): only "paused" applies.
 */
export async function messageUser(
  userId: string,
  message: OutboundMessage,
  options: { event?: EventKind; organizationId?: string; force?: boolean } = {},
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alertPrefs: true, messageChannels: { where: { enabled: true, target: { not: null } } } },
  });
  if (!user || user.messageChannels.length === 0) return 0;
  const prefs = readPrefs(user.alertPrefs);
  if (!options.force) {
    if (prefs.paused) return 0;
    if (options.event && !prefs.events[options.event]) return 0;
    if (options.organizationId && prefs.mutedSpaces.includes(options.organizationId)) return 0;
  }
  const results = await Promise.all(user.messageChannels.map((channel) => sendToChannel(channel, message)));
  return results.filter((result) => result.ok).length;
}

/** Everyone in a space who wants this kind of message. */
export async function messageOrganization(organizationId: string, event: EventKind, message: OutboundMessage): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, memberships: { select: { userId: true } } },
  });
  if (!organization) return;
  const titled = { ...message, title: `${message.title} · ${organization.name}` };
  await Promise.all(organization.memberships.map((member) => messageUser(member.userId, titled, { event, organizationId })));
}
