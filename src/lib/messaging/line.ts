/**
 * LINE as a first-class surface: Flex cards, the rich menu, postbacks and the
 * push/reply/content calls. The builders are pure (and tested); only the
 * small senders at the bottom touch the network.
 */
import "server-only";
import { signedShotUrl } from "@/lib/browser/shot-url";

export const LINE_API = "https://api.line.me/v2/bot";
const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "";

// --- message shapes ---------------------------------------------------------

export type LineMessage = Record<string, unknown>;
export const text = (t: string): LineMessage => ({ type: "text", text: t.slice(0, 4900) });

/** A picture LINE fetches itself: it must be a public https JPEG/PNG link. */
export const image = (url: string): LineMessage => ({ type: "image", originalContentUrl: url, previewImageUrl: url });

const SHOT = /^!\[[^\]]*\]\(\/api\/browser\/shot\?key=([A-Za-z0-9%._-]+)\)$/;

/** A reply as LINE messages: the words in one bubble, then each screenshot (markdown image lines) as a real picture. */
export function replyMessages(content: string): LineMessage[] {
  const words: string[] = [];
  const pictures: LineMessage[] = [];
  for (const line of content.split("\n")) {
    const key = SHOT.exec(line.trim())?.[1];
    if (key) pictures.push(image(signedShotUrl(decodeURIComponent(key))));
    else words.push(line);
  }
  const body = words.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return [...(body ? [text(body)] : []), ...pictures].slice(0, 5);
}

/** One-tap replies under a message. The label is what gets sent when tapped. */
export const withQuickReplies = (message: LineMessage, labels: string[]): LineMessage => ({
  ...message,
  quickReply: { items: labels.slice(0, 13).map((label) => ({ type: "action", action: { type: "message", label: label.slice(0, 20), text: label } })) },
});

/** What the approve/reject buttons send back. The webhook re-checks who tapped and what it is allowed to touch. */
export function postbackData(action: "approve" | "reject" | "paid", id: string): string {
  return `a=${action}&id=${id}`;
}
export function parsePostback(data: string): { action: "approve" | "reject" | "paid" | "show"; id: string } | null {
  const p = new URLSearchParams(data);
  const action = p.get("a");
  const id = p.get("id") ?? "";
  if ((action === "approve" || action === "reject" || action === "paid" || action === "show") && /^[a-z0-9]{10,40}$/i.test(id)) return { action, id };
  return null;
}

const button = (label: string, data: string, primary = false) => ({
  type: "button",
  style: primary ? "primary" : "secondary",
  height: "sm",
  action: { type: "postback", label, data, displayText: label },
});

/** The inline approval: exactly what will happen, then Approve / Not now. Nothing runs until Approve is tapped. */
export function approvalFlex(input: { actionItemId: string; verb: string; lines: string[]; agent: string; url?: string | null }): LineMessage {
  return {
    type: "flex",
    altText: `${input.verb}: needs your OK`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "Needs your OK", size: "xs", color: "#56627A" },
          { type: "text", text: input.verb, weight: "bold", size: "lg", wrap: true },
          ...input.lines.filter(Boolean).slice(0, 5).map((l) => ({ type: "text", text: l, size: "sm", wrap: true, color: "#1E2A45" })),
          { type: "text", text: `from ${input.agent}`, size: "xs", color: "#8390A6" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          button("Approve", postbackData("approve", input.actionItemId), true),
          button("Not now", postbackData("reject", input.actionItemId)),
          ...(input.url ? [{ type: "button", height: "sm", action: { type: "uri", label: "Open in Desker", uri: input.url } }] : []),
        ],
      },
    },
  };
}

const money = (minor: number, cur: string) => `${Math.round(minor / 100).toLocaleString("en-US")} ${cur}`;

/** Budget snapshot card: month so far against budget, with a bar. */
export function budgetFlex(d: { currency: string; spendMinor: number; budgetMinor: number | null; billsSoonMinor: number; insights: string[]; url?: string | null }): LineMessage {
  const pct = d.budgetMinor ? Math.min(100, Math.round((d.spendMinor / d.budgetMinor) * 100)) : 0;
  return {
    type: "flex",
    altText: `Spent ${money(d.spendMinor, d.currency)} this month`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "This month", size: "xs", color: "#56627A" },
          { type: "text", text: money(d.spendMinor, d.currency), weight: "bold", size: "xxl" },
          ...(d.budgetMinor
            ? [
                { type: "text", text: `of ${money(d.budgetMinor, d.currency)} budget · ${pct}%`, size: "sm", color: "#1E2A45" },
                { type: "box", layout: "vertical", height: "6px", backgroundColor: "#E6EAF2", cornerRadius: "3px", contents: [{ type: "box", layout: "vertical", width: `${Math.max(pct, 2)}%`, height: "6px", backgroundColor: pct >= 100 ? "#C2342B" : "#3558E6", cornerRadius: "3px", contents: [] }] },
              ]
            : [{ type: "text", text: "No budget set. Tell me one in chat.", size: "sm", color: "#56627A", wrap: true }]),
          ...(d.billsSoonMinor ? [{ type: "text", text: `${money(d.billsSoonMinor, d.currency)} of bills due within 7 days`, size: "sm", wrap: true }] : []),
          ...d.insights.slice(0, 3).map((i) => ({ type: "text", text: `• ${i}`, size: "sm", wrap: true, color: "#1E2A45" })),
        ],
      },
      ...(d.url ? { footer: { type: "box", layout: "vertical", contents: [{ type: "button", height: "sm", action: { type: "uri", label: "Open Money", uri: d.url } }] } } : {}),
    },
  };
}

/** Unpaid bills, each with a "Paid" button (it only marks the list; nothing is paid from here). */
export function billsFlex(bills: { id: string; payee: string; amountMinor: number; currency: string; dueAt: Date; risk: string }[]): LineMessage {
  return {
    type: "flex",
    altText: `${bills.length} unpaid bill${bills.length === 1 ? "" : "s"}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "Unpaid bills", weight: "bold", size: "lg" },
          ...bills.slice(0, 6).flatMap((b) => [
            { type: "box", layout: "horizontal", contents: [
              { type: "box", layout: "vertical", flex: 3, contents: [
                { type: "text", text: b.payee, size: "sm", wrap: true },
                { type: "text", text: `${b.risk === "overdue" ? "Overdue · " : "Due "}${b.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${money(b.amountMinor, b.currency)}`, size: "xs", color: b.risk === "overdue" ? "#C2342B" : "#56627A" },
              ] },
              { type: "button", flex: 2, height: "sm", action: { type: "postback", label: "Paid", data: postbackData("paid", b.id), displayText: `Paid: ${b.payee}` } },
            ] },
          ]),
        ],
      },
    },
  };
}

/** Rich menu: six tiles. "Add slip" opens the photo library, so a slip goes straight to the ledger. */
const RICH_MENU_AREAS = [
  { label: "Ask", color: "#3558E6", action: { type: "message", text: "What should I focus on today?" } },
  { label: "Budget", color: "#2E7D5B", action: { type: "message", text: "budget" } },
  { label: "My week", color: "#6B4FB8", action: { type: "message", text: "week" } },
  { label: "Needs OK", color: "#C2701F", action: { type: "message", text: "approvals" } },
  { label: "Bills", color: "#1E2A45", action: { type: "message", text: "bills" } },
  { label: "Add slip", color: "#B8456B", action: { type: "cameraRoll", label: "Add slip" } },
] as const;

export function richMenuDefinition() {
  const w = 2500 / 3;
  const h = 1686 / 2;
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "Desker Personal",
    chatBarText: "Menu",
    areas: RICH_MENU_AREAS.map((a, i) => ({
      bounds: { x: Math.round((i % 3) * w), y: Math.round(Math.floor(i / 3) * h), width: Math.round(w), height: Math.round(h) },
      action: a.action,
    })),
  };
}

/** The menu's picture, as SVG (rendered to PNG by the setup script). */
export function richMenuSvg(): string {
  const w = 2500 / 3;
  const h = 1686 / 2;
  const tiles = RICH_MENU_AREAS.map((a, i) => {
    const x = Math.round((i % 3) * w);
    const y = Math.round(Math.floor(i / 3) * h);
    return `<rect x="${x + 6}" y="${y + 6}" width="${Math.round(w) - 12}" height="${Math.round(h) - 12}" rx="36" fill="${a.color}"/><text x="${x + Math.round(w / 2)}" y="${y + Math.round(h / 2) + 26}" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#fff" text-anchor="middle">${a.label}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686"><rect width="2500" height="1686" fill="#F8FAFD"/>${tiles}</svg>`;
}

// --- network ----------------------------------------------------------------

async function call(path: string, body: unknown): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await fetch(`${LINE_API}${path}`, { method: "POST", headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    return { ok: r.ok, detail: r.ok ? "" : `${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Couldn't reach LINE." };
  }
}

export const linePush = (to: string, messages: LineMessage[]) => call("/message/push", { to, messages: messages.slice(0, 5) });
export const lineReplyMessages = (replyToken: string, messages: LineMessage[]) => call("/message/reply", { replyToken, messages: messages.slice(0, 5) });
/** Shows the "typing" dots for up to a minute while the answer is worked out. */
export const lineLoading = (chatId: string) => call("/chat/loading/start", { chatId, loadingSeconds: 30 });

/** A photo the person sent, as bytes. */
export async function lineContent(messageId: string): Promise<{ data: Buffer; type: string } | null> {
  const r = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, { headers: { authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return null;
  return { data: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") ?? "image/jpeg" };
}
