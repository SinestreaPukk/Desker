/**
 * The weekly digest: one synthesized brief of the week's cross-domain
 * conflicts and trade-offs, sent Monday morning (the person's time zone)
 * through whichever channels they have linked.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { localIso, validTimeZone } from "@/lib/local-time";
import { messageUser } from "@/lib/messaging/send";
import { readPrefs } from "@/lib/messaging/prefs";
import { teamOf } from "@/lib/team";
import { personalSpace } from "./chat";
import { readLife } from "./read";
import { weeklyDigest } from "./negotiate";

const WEEK_MS = 6 * 86_400_000;

export async function composeLifeDigest(userId: string) {
  const space = await personalSpace(userId);
  if (!space) return null;
  const [life, team, user] = await Promise.all([readLife(space.projectId), teamOf(space.projectId), prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { alertPrefs: true } })]);
  const timeZone = validTimeZone(readPrefs(user.alertPrefs).timeZone);
  const digest = await weeklyDigest({ life, organizationId: space.organizationId, team, timeZone });
  return { ...digest, url: env.appUrl ? `${env.appUrl}/` : null };
}

/** Hourly tick: Monday from 08:00 local, once a week per person. */
export async function runDueLifeDigests(now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    where: { messageChannels: { some: { enabled: true, target: { not: null } } } },
    select: { id: true, alertPrefs: true, lastLifeDigestAt: true },
  });
  let sent = 0;
  for (const user of users) {
    const prefs = readPrefs(user.alertPrefs);
    if (prefs.paused) continue;
    const local = new Date(`${localIso(now, validTimeZone(prefs.timeZone)).slice(0, 16)}Z`);
    if (local.getUTCDay() !== 1 || local.getUTCHours() < 8) continue;
    if (user.lastLifeDigestAt && now.getTime() - user.lastLifeDigestAt.getTime() < WEEK_MS) continue;
    // Claimed first, so two overlapping ticks never send two digests.
    const won = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ lastLifeDigestAt: null }, { lastLifeDigestAt: { lt: new Date(now.getTime() - WEEK_MS) } }] },
      data: { lastLifeDigestAt: now },
    });
    if (won.count === 0) continue;
    try {
      const digest = await composeLifeDigest(user.id);
      if (digest && (await messageUser(user.id, digest))) sent++;
    } catch (error) {
      console.error(`[life] digest failed for ${user.id}`, error);
    }
  }
  return sent;
}
