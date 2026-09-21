/**
 * What an organisation has used this month against what its plan allows.
 * One read for the billing page, the same numbers the limits enforce.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { costOf } from "@/lib/pricing";
import { usagePeriod } from "@/lib/usage";
import { planFor, type Plan } from "./plans";

export interface UsageSnapshot {
  period: string;
  periodStart: string;
  plan: Plan;
  publishedAgents: number;
  actionItems: number;
  conversations: number;
  modelCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

export function periodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function usageSnapshot(organizationId: string, now = new Date()): Promise<UsageSnapshot> {
  const start = periodStart(now);
  const [org, publishedAgents, actionItems, conversations, counters] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { plan: true } }),
    prisma.agent.count({
      where: { status: "published", project: { organizationId } },
    }),
    prisma.actionItem.count({ where: { organizationId, createdAt: { gte: start } } }),
    prisma.conversation.count({
      where: {
        createdAt: { gte: start },
        agent: { project: { organizationId } },
        NOT: { clientSessionId: { startsWith: "preview:" } },
      },
    }),
    prisma.usageCounter.findMany({
      where: { organizationId, period: usagePeriod(now) },
      select: { provider: true, model: true, inputTokens: true, outputTokens: true, searches: true },
    }),
  ]);

  let modelCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;
  for (const row of counters) {
    if (row.provider === "search") {
      searches += row.searches;
      continue;
    }
    inputTokens += row.inputTokens;
    outputTokens += row.outputTokens;
    modelCostUsd += costOf(row.model, row.inputTokens, row.outputTokens) ?? 0;
  }

  return {
    period: usagePeriod(now),
    periodStart: start.toISOString(),
    plan: planFor(org.plan),
    publishedAgents,
    actionItems,
    conversations,
    modelCostUsd,
    inputTokens,
    outputTokens,
    searches,
  };
}
