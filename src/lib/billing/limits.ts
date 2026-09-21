/**
 * Plan limits, enforced where the cost is incurred - never only in the UI.
 *
 * Each check answers with a reason a person can read, and the callers turn a
 * refusal into the right response for their surface: a 402 for an owner, a
 * quiet "unavailable" for a client on a public widget, a failed action item
 * for a schedule. Nothing here throws on its own.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { planFor } from "./plans";
import { usageSnapshot } from "./usage";

export interface LimitCheck {
  allowed: boolean;
  /** Present when refused. Plain language, names the plan. */
  reason?: string;
  /** Present for rate limits, in seconds. */
  retryAfterSeconds?: number;
}

const ok: LimitCheck = { allowed: true };

/** Publishing one more agent. */
export async function canPublishAgent(organizationId: string, agentId: string): Promise<LimitCheck> {
  const [org, published] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { plan: true } }),
    prisma.agent.findMany({
      where: { status: "published", project: { organizationId } },
      select: { id: true },
    }),
  ]);
  if (published.some((a) => a.id === agentId)) return ok; // already live
  const plan = planFor(org.plan);
  if (published.length >= plan.limits.publishedAgents) {
    return {
      allowed: false,
      reason: `The ${plan.name} plan allows ${plan.limits.publishedAgents} published agent${plan.limits.publishedAgents === 1 ? "" : "s"}. Unpublish one, or upgrade under Organization → Billing.`,
    };
  }
  return ok;
}

/** Starting one more autonomous run: monthly quota, cost cap, and the hourly rate. */
export async function canStartRun(organizationId: string): Promise<LimitCheck> {
  const usage = await usageSnapshot(organizationId);
  const { plan } = usage;
  if (usage.actionItems >= plan.limits.actionItemsPerMonth) {
    return {
      allowed: false,
      reason: `The ${plan.name} plan allows ${plan.limits.actionItemsPerMonth.toLocaleString()} runs a month and this organisation has used them. Runs resume next month, or sooner on a bigger plan.`,
    };
  }
  if (usage.modelCostUsd >= plan.limits.modelCostUsdPerMonth) {
    return {
      allowed: false,
      reason: `This organisation has reached the ${plan.name} plan's $${plan.limits.modelCostUsdPerMonth} monthly model budget. Runs resume next month, or sooner on a bigger plan.`,
    };
  }
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const lastHour = await prisma.actionItem.count({
    where: { organizationId, createdAt: { gte: hourAgo } },
  });
  if (lastHour >= plan.limits.runsPerHour) {
    return {
      allowed: false,
      reason: `More than ${plan.limits.runsPerHour} runs started in the last hour, which is the ${plan.name} plan's rate. Try again shortly.`,
      retryAfterSeconds: 600,
    };
  }
  return ok;
}

/**
 * A client message on a public agent: new conversations count against the
 * monthly quota; every message counts against the per-minute rate; the model
 * budget applies to both. The client sees "unavailable", the owner sees why.
 */
export async function canAcceptClientMessage(
  organizationId: string,
  isNewConversation: boolean,
): Promise<LimitCheck> {
  const usage = await usageSnapshot(organizationId);
  const { plan } = usage;
  if (isNewConversation && usage.conversations >= plan.limits.conversationsPerMonth) {
    return {
      allowed: false,
      reason: `The ${plan.name} plan allows ${plan.limits.conversationsPerMonth.toLocaleString()} conversations a month and this organisation has used them.`,
    };
  }
  if (usage.modelCostUsd >= plan.limits.modelCostUsdPerMonth) {
    return {
      allowed: false,
      reason: `This organisation has reached the ${plan.name} plan's $${plan.limits.modelCostUsdPerMonth} monthly model budget.`,
    };
  }
  const minuteAgo = new Date(Date.now() - 60_000);
  const lastMinute = await prisma.message.count({
    where: {
      role: "user",
      createdAt: { gte: minuteAgo },
      conversation: { agent: { project: { organizationId } } },
    },
  });
  if (lastMinute >= plan.limits.chatMessagesPerMinute) {
    return {
      allowed: false,
      reason: `More than ${plan.limits.chatMessagesPerMinute} client messages a minute across this organisation's agents, which is the ${plan.name} plan's rate.`,
      retryAfterSeconds: 30,
    };
  }
  return ok;
}
