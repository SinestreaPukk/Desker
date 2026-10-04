/**
 * Everything someone can do in our LINE account, beyond a plain text: the
 * rich-menu commands, photos of slips, approval taps, and free chat. It is
 * the same system as the web: the same router and agents (chatOnce), the
 * same ledger, and approvals go through the one approveItem/rejectItem.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";
import { agentsVisibleTo } from "@/lib/tenancy/projects";
import { approveItem, rejectItem } from "@/lib/work/decide";
import { previewPending } from "@/lib/work/pending-preview";
import type { PendingAction } from "@/lib/work/types";
import { chatTurn, personalSpace } from "@/lib/life/chat";
import { receiveAttachment } from "@/lib/life/attachments";
import { readLife } from "@/lib/life/read";
import { moneyInsights } from "@/lib/life/money-insights";
import { composeLifeDigest } from "@/lib/life/digest";
import * as store from "@/lib/life/store";
import { handleInbound } from "./inbound";
import { parseCommand } from "./prefs";
import { senderKey } from "./send";
import { approvalFlex, billsFlex, budgetFlex, lineContent, lineLoading, linePush, lineReplyMessages, parsePostback, replyMessages, text, withQuickReplies, type LineMessage } from "./line";

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; id?: string; text?: string; fileName?: string };
  postback?: { data?: string };
}

/** Rich-menu words, English and Thai. */
export function parseLineCommand(raw: string): "budget" | "week" | "approvals" | "bills" | null {
  const w = raw.trim().toLowerCase();
  if (/^(budget|money|งบ|งบประมาณ)$/.test(w)) return "budget";
  if (/^(week|my week|digest|สัปดาห์|สรุปสัปดาห์)$/.test(w)) return "week";
  if (/^(approvals|needs ok|needs you|อนุมัติ)$/.test(w)) return "approvals";
  if (/^(bills|บิล|ใบแจ้งหนี้)$/.test(w)) return "bills";
  return null;
}

async function budgetCard(projectId: string): Promise<LineMessage> {
  const [life, entries] = await Promise.all([
    readLife(projectId),
    prisma.lifeEntry.findMany({ where: { projectId, occurredAt: { gte: new Date(Date.now() - 200 * 86_400_000) } }, take: 2000 }),
  ]);
  const insights = moneyInsights(entries, new Date(), life.money.monthBudgetMinor);
  return budgetFlex({ currency: life.money.currency, spendMinor: life.money.monthSpendMinor, budgetMinor: life.money.monthBudgetMinor, billsSoonMinor: life.money.billsDueSoonMinor, insights: insights.insights, url: env.appUrl ? `${env.appUrl}/` : null });
}

async function pendingApprovals(userId: string): Promise<LineMessage[]> {
  const items = await prisma.actionItem.findMany({
    where: { status: "needs_approval", agent: agentsVisibleTo(userId) },
    orderBy: { awaitingSince: "asc" },
    take: 4,
    select: { id: true, pendingAction: true, agent: { select: { name: true } } },
  });
  const out: LineMessage[] = [];
  for (const item of items) {
    const pending = item.pendingAction as PendingAction | null;
    if (!pending) continue;
    const draft = pending.draftId ? await prisma.draft.findUnique({ where: { id: pending.draftId }, select: { title: true, body: true } }) : null;
    out.push(approvalFlex({ actionItemId: item.id, agent: item.agent.name, ...previewPending(pending, draft) }));
  }
  return out.length ? out : [text("Nothing is waiting on you.")];
}

async function postback(userId: string, data: string): Promise<LineMessage[]> {
  const p = parsePostback(data);
  if (!p) return [text("That button has expired.")];
  const space = await personalSpace(userId);
  if (p.action === "paid") {
    if (!space) return [text("Your space isn't set up yet.")];
    const bill = await prisma.lifeEntry.findFirst({ where: { id: p.id, projectId: space.projectId, kind: "bill" }, select: { payee: true } });
    if (!bill) return [text("I couldn't find that bill.")];
    await store.markBill({ ...space, source: "chat" }, p.id, "paid");
    return [text(`Marked ${bill.payee} as paid. (Nothing was paid from here.)`)];
  }
  // The tapper must be able to act on this item, exactly as on the web.
  const item = await prisma.actionItem.findFirst({ where: { id: p.id, agent: agentsVisibleTo(userId) }, select: { status: true } });
  if (!item) return [text("I couldn't find that request.")];
  if (item.status !== "needs_approval") return [text(`That one is already ${item.status.replace("_", " ")}.`)];
  try {
    if (p.action === "approve") {
      await approveItem(p.id, userId);
      return [text("Approved. Going out now.")];
    }
    await rejectItem(p.id, userId, "Declined in LINE.");
    return [text("Okay, I won't do that.")];
  } catch (error) {
    return [text(error instanceof Error ? error.message : "That didn't work.")];
  }
}

/** A photo or file the person sent: the same pipeline as the web chat. */
async function attachment(userId: string, messageId: string, name: string, isImage: boolean): Promise<LineMessage[]> {
  const space = await personalSpace(userId);
  const file = await lineContent(messageId);
  if (!space || !file) return [text("I couldn't open that. Try sending it again.")];
  const agent = await prisma.agent.findFirst({ where: { projectId: space.projectId, status: "published" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  // LINE names a photo nothing: take the extension from what it actually is.
  const fileName = isImage ? `photo${/png/.test(file.type) ? ".png" : /webp/.test(file.type) ? ".webp" : /gif/.test(file.type) ? ".gif" : ".jpg"}` : name;
  const reply = await receiveAttachment(space, agent?.id ?? null, { name: fileName, type: file.type, data: file.data });
  return [reply.nextSteps ? withQuickReplies(text(reply.text), reply.nextSteps) : text(reply.text)];
}

/** Handles one webhook event. Never throws: a bad event must not stop the rest. */
export async function handleLineEvent(event: LineEvent): Promise<void> {
  const chatId = event.source?.userId;
  if (!chatId) return;
  const reply = async (messages: LineMessage[]) => {
    const r = event.replyToken ? await lineReplyMessages(event.replyToken, messages) : { ok: false, detail: "" };
    if (!r.ok) await linePush(chatId, messages);
  };
  try {
    const channel = await prisma.messageChannel.findUnique({ where: { senderKey: senderKey("line", chatId) }, select: { userId: true } });
    const raw = event.type === "follow" ? "help" : event.type === "message" && event.message?.type === "text" ? (event.message.text ?? "") : null;

    // Not linked yet: the link code flow (and the greeting) is the old handler's job.
    if (!channel) {
      if (raw !== null) await reply([text(await handleInbound("line", chatId, raw))]);
      return;
    }
    const userId = channel.userId;

    if (event.type === "postback" && event.postback?.data) return void (await reply(await postback(userId, event.postback.data)));

    if (event.type === "message" && (event.message?.type === "image" || event.message?.type === "file") && event.message.id) {
      return void (await reply(await attachment(userId, event.message.id, event.message.type === "file" ? (event.message.fileName ?? "file") : "photo.jpg", event.message.type === "image")));
    }
    if (event.type === "message" && (event.message?.type === "audio" || event.message?.type === "video")) {
      return void (await reply([text("I can't listen to voice messages or watch videos yet. Type it or send a photo.")]));
    }

    if (raw === null) return;
    const space = await personalSpace(userId);
    switch (parseLineCommand(raw)) {
      case "budget":
        return void (await reply(space ? [await budgetCard(space.projectId)] : [text("Your space isn't set up yet.")]));
      case "bills": {
        const rows = space ? await prisma.lifeEntry.findMany({ where: { projectId: space.projectId, kind: "bill", status: { not: "paid" } }, orderBy: { occurredAt: "asc" }, take: 6 }) : [];
        const now = Date.now();
        return void (await reply(rows.length ? [billsFlex(rows.map((b) => ({ id: b.id, payee: b.payee, amountMinor: b.amountMinor, currency: b.currency, dueAt: b.occurredAt, risk: b.occurredAt.getTime() < now ? "overdue" : "later" })))] : [text("No unpaid bills.")]));
      }
      case "approvals":
        return void (await reply(await pendingApprovals(userId)));
      case "week": {
        const d = await composeLifeDigest(userId);
        return void (await reply([text(d ? `${d.title}\n\n${d.body}` : "Your space isn't set up yet.")]));
      }
    }
    if (parseCommand(raw)) return void (await reply([text(await handleInbound("line", chatId, raw))]));

    // Free chat: the same front door as the web. The answer is pushed, so a slow model never loses the reply token.
    await lineLoading(chatId);
    const { said, later } = await chatTurn(userId, raw.trim());
    // One bubble per agent, named, so it is clear who is answering.
    await linePush(chatId, said.flatMap((s) => replyMessages(s.agent && said.length > 1 ? `${s.agent}\n${s.text}` : s.text)));
    // A reminder that is seconds away waits here, after the confirmation has been sent.
    await later?.();
  } catch (error) {
    console.error("[line] event failed", error);
  }
}
