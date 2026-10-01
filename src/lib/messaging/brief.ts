/**
 * The morning brief: today's calendar, what waits on you, what got done
 * overnight, and the news you follow - one message, in the app you chose.
 * Built from what's already in the database plus a news feed: no model call,
 * so it costs nothing and can't make things up.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { calendarAccess, listEvents } from "@/lib/integrations/mail-calendar";
import { localIso, offsetOf, validTimeZone } from "@/lib/local-time";
import { previousFire } from "@/lib/work/scope";
import { briefCron, NEWS_EDITIONS, readPrefs, type AlertPrefs } from "./prefs";
import { messageUser, type OutboundMessage } from "./send";

const LIST = 4;
/** A brief more than three hours late is stale: skip to tomorrow's. */
const LATE_MS = 3 * 60 * 60_000;

export interface Headline {
  title: string;
  source: string;
  url: string;
}

const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

/** Google News RSS items. Its titles end " - Source"; that part moves to `source`. */
export function parseNewsRss(xml: string): Headline[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const field = (name: string) => decode(item!.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
    const source = field("source");
    const title = field("title");
    const url = field("link");
    if (!title || !url) return [];
    return [{ title: source && title.endsWith(` - ${source}`) ? title.slice(0, -source.length - 3) : title, source, url }];
  });
}

export async function newsFor(topic: string, edition: string): Promise<Headline[]> {
  const [country, language] = (NEWS_EDITIONS.find((e) => e.id === edition)?.id ?? "US:en").split(":") as [string, string];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${topic} when:1d`)}&hl=${language}&gl=${country}&ceid=${country}:${language}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Desker brief" } });
    return response.ok ? parseNewsRss(await response.text()).slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function newsSection(prefs: AlertPrefs): Promise<string[]> {
  const sections = await Promise.all(
    prefs.news.topics.map(async (topic) => {
      const headlines = await newsFor(topic, prefs.news.edition);
      if (headlines.length === 0) return null;
      return `📰 ${topic}\n${headlines.map((h) => `• ${h.title}${h.source ? ` (${h.source})` : ""}\n  ${h.url}`).join("\n")}`;
    }),
  );
  return sections.filter((section): section is string => Boolean(section));
}

export async function composeNews(userId: string): Promise<OutboundMessage> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { alertPrefs: true } });
  const prefs = readPrefs(user.alertPrefs);
  if (prefs.news.topics.length === 0) {
    return { title: "No news topics yet", body: "Add the topics you follow under Alerts in Desker, then send \"news\" again." };
  }
  const sections = await newsSection(prefs);
  return { title: "Your news", body: sections.length ? sections.join("\n\n") : "No new stories on your topics in the last day." };
}

/** The start of what a finished task reported: a morning report reads in the brief itself. */
export function reportOf(result: unknown): string {
  const summary = (result as { summary?: unknown } | null)?.summary;
  if (typeof summary !== "string" || !summary.trim()) return "";
  const text = summary.replace(/[#*_`>]/g, "").replace(/\s*\n+\s*/g, " ").trim();
  return `\n  ${text.length > 400 ? `${text.slice(0, 399)}…` : text}`;
}

const hm = (iso: string, timeZone: string) => localIso(iso, timeZone).slice(11, 16);

/** `previousBrief`: where the recap starts. The scheduler passes the one from before it claimed this brief. */
export async function composeBrief(userId: string, now = new Date(), previousBrief?: Date | null): Promise<OutboundMessage> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      firstName: true,
      alertPrefs: true,
      lastBriefAt: true,
      memberships: { select: { role: true, organizationId: true, organization: { select: { name: true } } } },
    },
  });
  const prefs = readPrefs(user.alertPrefs);
  const timeZone = validTimeZone(prefs.timeZone);
  const orgs = user.memberships.filter((m) => !prefs.mutedSpaces.includes(m.organizationId));
  const orgIds = orgs.map((m) => m.organizationId);
  const named = orgs.length > 1;
  const sections: string[] = [];
  /** Straight to the oldest thing waiting, so the brief opens the work instead of a space picker. */
  let waitingPath: string | null = null;

  if (prefs.brief.calendar) {
    // Only calendars the person owns: a colleague's connected calendar isn't theirs to read.
    const day = localIso(now, timeZone).slice(0, 10);
    const offset = offsetOf(now, timeZone);
    for (const membership of orgs.filter((m) => m.role === "owner")) {
      const access = await calendarAccess(membership.organizationId).catch(() => null);
      if (!access) continue;
      const events = await listEvents(access, { from: `${day}T00:00:00${offset}`, to: `${day}T23:59:59${offset}` }).catch(() => null);
      if (!events) continue;
      sections.push(
        events.length
          ? `📅 Today\n${events
              .slice(0, 8)
              .map((e) => `• ${e.allDay ? "All day" : `${hm(e.start, timeZone)}–${hm(e.end, timeZone)}`} ${e.title}`)
              .join("\n")}`
          : "📅 Nothing on your calendar today.",
      );
      break;
    }
  }

  if (prefs.brief.waiting && orgIds.length) {
    const [approvals, issues] = await Promise.all([
      prisma.actionItem.findMany({
        where: { organizationId: { in: orgIds }, status: "needs_approval" },
        orderBy: { awaitingSince: "asc" },
        select: { headline: true, agent: { select: { name: true, project: { select: { slug: true } } } }, organization: { select: { name: true } } },
      }),
      prisma.issue.findMany({
        where: { status: "open", agent: { project: { organizationId: { in: orgIds } } } },
        orderBy: { createdAt: "asc" },
        select: { summary: true, agent: { select: { name: true, project: { select: { slug: true, organization: { select: { name: true } } } } } } },
      }),
    ]);
    const lines = [
      ...approvals.map((a) => `• ${a.headline ?? "A draft"} (${a.agent.name}${named ? `, ${a.organization.name}` : ""})`),
      ...issues.map((i) => `• ${i.summary} (${i.agent.name}${named ? `, ${i.agent.project.organization.name}` : ""})`),
    ];
    if (lines.length) {
      const slug = approvals[0]?.agent.project.slug ?? issues[0]?.agent.project.slug;
      if (slug) waitingPath = `/p/${slug}/needs-you`;
      sections.push(`✋ Waiting on you (${lines.length})\n${lines.slice(0, LIST).join("\n")}${lines.length > LIST ? `\n• and ${lines.length - LIST} more` : ""}`);
    }
  }

  if (prefs.brief.recap && orgIds.length) {
    const last = previousBrief === undefined ? user.lastBriefAt : previousBrief;
    const since = last && now.getTime() - last.getTime() < 3 * 86_400_000 ? last : new Date(now.getTime() - 86_400_000);
    const done = await prisma.actionItem.findMany({
      where: { organizationId: { in: orgIds }, status: { in: ["done", "failed"] }, completedAt: { gt: since } },
      orderBy: { completedAt: "desc" },
      select: { status: true, headline: true, result: true, agent: { select: { name: true } } },
    });
    const finished = done.filter((d) => d.status === "done");
    const failed = done.length - finished.length;
    if (done.length) {
      sections.push(
        `✅ Since your last brief: ${finished.length} done${failed ? `, ${failed} failed` : ""}\n${finished
          .slice(0, LIST)
          .map((d) => `• ${d.agent.name}: ${d.headline ?? "Finished a task"}${reportOf(d.result)}`)
          .join("\n")}`.trim(),
      );
    }
  }

  if (prefs.brief.news) sections.push(...(await newsSection(prefs)));

  const date = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now);
  return {
    title: `Good morning${user.firstName ? `, ${user.firstName}` : ""}. ${date}`,
    body: sections.length ? sections.join("\n\n") : "Nothing waiting on you. Have a good day.",
    url: env.appUrl ? `${env.appUrl}${waitingPath ?? "/choose-space"}` : null,
  };
}

/** Every 15 minutes: each person whose brief time has come round today gets one. */
export async function runDueBriefs(now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    where: { messageChannels: { some: { enabled: true, target: { not: null } } } },
    select: { id: true, alertPrefs: true, lastBriefAt: true },
  });
  let sent = 0;
  for (const user of users) {
    const prefs = readPrefs(user.alertPrefs);
    const cron = briefCron(prefs.brief);
    if (prefs.paused || !cron) continue;
    const due = previousFire(cron, validTimeZone(prefs.timeZone), now);
    if (!due || now.getTime() - due.getTime() > LATE_MS) continue;
    if (user.lastBriefAt && user.lastBriefAt >= due) continue;
    // Claimed first, so two overlapping ticks never send two briefs.
    const won = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ lastBriefAt: null }, { lastBriefAt: { lt: due } }] },
      data: { lastBriefAt: now },
    });
    if (won.count === 0) continue;
    try {
      if (await messageUser(user.id, await composeBrief(user.id, now, user.lastBriefAt))) sent++;
    } catch (error) {
      // One person's brief must not stop everyone else's.
      console.error(`[messaging] brief failed for ${user.id}`, error);
    }
  }
  return sent;
}
