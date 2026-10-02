import { prisma } from "@/lib/db";
import { liffUser } from "@/lib/messaging/liff";
import { personalSpace } from "@/lib/life/chat";
import { readLife } from "@/lib/life/read";
import { moneyInsights } from "@/lib/life/money-insights";
import { composeLifeDigest } from "@/lib/life/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The data behind the LIFF mini-app views: "budget" and "digest". */
export async function GET(request: Request, { params }: { params: Promise<{ view: string }> }) {
  const userId = await liffUser(request);
  if (!userId) return Response.json({ error: "Open this from LINE, after connecting LINE in Alerts." }, { status: 401 });
  const space = await personalSpace(userId);
  if (!space) return Response.json({ error: "Your space isn't set up yet." }, { status: 404 });
  const { view } = await params;
  if (view === "digest") return Response.json(await composeLifeDigest(userId));
  if (view !== "budget") return Response.json({ error: "Unknown view." }, { status: 404 });
  const [life, entries] = await Promise.all([
    readLife(space.projectId),
    prisma.lifeEntry.findMany({ where: { projectId: space.projectId, occurredAt: { gte: new Date(Date.now() - 200 * 86_400_000) } }, take: 2000 }),
  ]);
  return Response.json({ ...moneyInsights(entries, new Date(), life.money.monthBudgetMinor), budgetMinor: life.money.monthBudgetMinor, spendMinor: life.money.monthSpendMinor });
}
