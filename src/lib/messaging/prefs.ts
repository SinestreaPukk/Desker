/**
 * What Desker messages a person about, where, and when. Pure and shared: the
 * settings page, the API and the senders read the same lists.
 */
import { z } from "zod";

export const CHANNEL_KINDS = ["line", "whatsapp", "telegram", "email", "slack", "discord", "teams"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

/** chat: linked by sending a code from the app. webhook: a pasted URL. email: the account address. */
export const CHANNELS: Record<ChannelKind, { name: string; how: "chat" | "webhook" | "email"; hint: string }> = {
  line: { name: "LINE", how: "chat", hint: "Add our LINE account and send it a code." },
  whatsapp: { name: "WhatsApp", how: "chat", hint: "Send our WhatsApp number a code." },
  telegram: { name: "Telegram", how: "chat", hint: "Start our Telegram bot." },
  email: { name: "Email", how: "email", hint: "To the address you sign in with." },
  slack: { name: "Slack", how: "webhook", hint: "Paste an incoming webhook URL for a channel." },
  discord: { name: "Discord", how: "webhook", hint: "Paste a channel webhook URL." },
  teams: { name: "Microsoft Teams", how: "webhook", hint: "Paste a Workflows webhook URL for a channel." },
};

/** Where each kind of webhook may point. Anything else is refused, so nobody can aim our server at an arbitrary host. */
export const WEBHOOK_HOSTS: Partial<Record<ChannelKind, RegExp>> = {
  slack: /^hooks\.slack\.com$/,
  discord: /^(discord|discordapp)\.com$/,
  teams: /(\.logic\.azure\.com|\.api\.powerplatform\.com|\.webhook\.office\.com)$/,
};

export function webhookAllowed(kind: ChannelKind, url: string): boolean {
  const host = WEBHOOK_HOSTS[kind];
  if (!host) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && host.test(parsed.hostname);
  } catch {
    return false;
  }
}

export const EVENT_KINDS = ["approval", "escalation", "failure", "issue", "digest", "done"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENTS: Record<EventKind, { label: string; hint: string }> = {
  approval: { label: "Something needs your OK", hint: "An email, post or event waiting for your approval." },
  escalation: { label: "An agent asks for you", hint: "A chat handed to a person, or an agent stopped to ask." },
  failure: { label: "A task failed", hint: "Scheduled work that stopped or ran too long." },
  issue: { label: "Serious issues", hint: "Critical problems agents report." },
  digest: { label: "Agent digests", hint: "An agent's daily or weekly summary." },
  done: { label: "Every finished task", hint: "Can be a lot on a busy day." },
};

/** Google News editions: country and language. */
export const NEWS_EDITIONS = [
  { id: "US:en", label: "United States · English" },
  { id: "GB:en", label: "United Kingdom · English" },
  { id: "TH:th", label: "ประเทศไทย · ไทย" },
  { id: "SG:en", label: "Singapore · English" },
  { id: "IN:en", label: "India · English" },
  { id: "AU:en", label: "Australia · English" },
  { id: "JP:ja", label: "日本 · 日本語" },
  { id: "VN:vi", label: "Việt Nam · Tiếng Việt" },
  { id: "ID:id", label: "Indonesia · Bahasa Indonesia" },
  { id: "DE:de", label: "Deutschland · Deutsch" },
  { id: "FR:fr", label: "France · Français" },
  { id: "ES:es", label: "España · Español" },
  { id: "BR:pt-419", label: "Brasil · Português" },
] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const prefsSchema = z.object({
  /** Stops everything without losing any setting. */
  paused: z.boolean(),
  timeZone: z.string().max(64),
  events: z.object(Object.fromEntries(EVENT_KINDS.map((kind) => [kind, z.boolean()])) as Record<EventKind, z.ZodBoolean>),
  /** Spaces this person doesn't want alerts from. */
  mutedSpaces: z.array(z.string().max(64)).max(50),
  brief: z.object({
    on: z.boolean(),
    time,
    /** 0 Sunday to 6 Saturday. */
    days: z.array(z.number().int().min(0).max(6)).max(7),
    calendar: z.boolean(),
    waiting: z.boolean(),
    recap: z.boolean(),
    news: z.boolean(),
  }),
  news: z.object({
    topics: z.array(z.string().trim().min(1).max(60)).max(5),
    edition: z.string().max(12),
  }),
});
export type AlertPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: AlertPrefs = {
  paused: false,
  timeZone: "UTC",
  events: { approval: true, escalation: true, failure: true, issue: true, digest: true, done: false },
  mutedSpaces: [],
  brief: { on: true, time: "07:30", days: [0, 1, 2, 3, 4, 5, 6], calendar: true, waiting: true, recap: true, news: true },
  news: { topics: [], edition: "US:en" },
};

/** Whatever is stored, merged over the defaults: a setting added later never breaks an old row. */
export function readPrefs(stored: unknown): AlertPrefs {
  const raw = (stored && typeof stored === "object" ? stored : {}) as Partial<AlertPrefs>;
  const merged = {
    ...DEFAULT_PREFS,
    ...raw,
    events: { ...DEFAULT_PREFS.events, ...raw.events },
    brief: { ...DEFAULT_PREFS.brief, ...raw.brief },
    news: { ...DEFAULT_PREFS.news, ...raw.news },
  };
  const parsed = prefsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

/** Brief time and days as a cron, for the scheduler's "when was it last due". */
export function briefCron(brief: AlertPrefs["brief"]): string | null {
  if (!brief.on || brief.days.length === 0) return null;
  const [hour, minute] = brief.time.split(":").map(Number);
  return `${minute} ${hour} * * ${[...brief.days].sort().join(",")}`;
}

/** Words a person can send the bot. Thai too: most of the beta is on LINE in Thailand. */
export function parseCommand(text: string): "brief" | "news" | "pause" | "resume" | "help" | null {
  const word = text.trim().toLowerCase().replace(/^\//, "");
  if (/^(brief|morning|today|สรุป|สรุปวันนี้)$/.test(word)) return "brief";
  if (/^(news|ข่าว)$/.test(word)) return "news";
  if (/^(pause|stop|mute|หยุด)$/.test(word)) return "pause";
  if (/^(resume|unpause|unmute|start|เริ่ม)$/.test(word)) return "resume";
  if (/^(help|\?|ช่วย|วิธีใช้)$/.test(word)) return "help";
  return null;
}

/** A link code: six characters with no 0/O or 1/I to misread. */
export const LINK_CODE = /\b([A-HJ-NP-Z2-9]{6})\b/;
