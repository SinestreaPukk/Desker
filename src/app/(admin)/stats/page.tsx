import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

/** Who may open this page: comma-separated emails in ADMIN_EMAILS. Anyone else sees a 404. */
const admins = () => (process.env.ADMIN_EMAILS || "tigerpukk@gmail.com").toLowerCase().split(",").map((e) => e.trim());

const DAY = 86_400_000;

export default async function StatsPage() {
  const user = await currentUser();
  if (!user || !admins().includes(user.email.toLowerCase())) notFound();

  const since7 = new Date(Date.now() - 7 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);
  const [users, orgs, recent, withChannel, busyOrgs, tasks7] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.user.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.user.count({ where: { messageChannels: { some: { enabled: true } } } }),
    prisma.actionItem.groupBy({ by: ["organizationId"], where: { createdAt: { gte: since7 } } }),
    prisma.actionItem.count({ where: { createdAt: { gte: since7 } } }),
  ]);
  const active = await prisma.membership.findMany({
    where: { organizationId: { in: busyOrgs.map((o) => o.organizationId) } },
    distinct: ["userId"],
    select: { userId: true },
  });

  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10));
  const perDay = days.map((d) => [d, recent.filter((u) => u.createdAt.toISOString().slice(0, 10) === d).length] as const);

  const cards: [string, number][] = [
    ["Users", users],
    ["Signed up, last 7 days", recent.filter((u) => u.createdAt >= since7).length],
    ["Active, last 7 days (their space ran a task)", active.length],
    ["Tasks run, last 7 days", tasks7],
    ["Spaces", orgs],
    ["Users with alerts on", withChannel],
  ];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Stats</h1>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-4">
            <div className="text-xl font-semibold">{value}</div>
            <div className="text-sm opacity-70">{label}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-medium">Sign-ups per day (UTC)</h2>
      <ul className="mt-2 text-sm">
        {perDay.map(([d, n]) => (
          <li key={d} className="flex gap-3 py-0.5">
            <span className="w-24 tabular-nums">{d}</span>
            <span>{"█".repeat(n)} {n}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
