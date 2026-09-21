/**
 * Plan tiers. No server imports: the billing page renders these too.
 *
 * Priced around the two things that cost money: how many agents are live,
 * and how much they do each month. Model spend is capped per plan in dollars
 * so one runaway schedule cannot rack up a bill nobody agreed to; rate limits
 * bound how fast that spend can happen.
 */

export const PLAN_IDS = ["free", "starter", "growth"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** Agents that may be published at once. */
  publishedAgents: number;
  /** Autonomous runs started per calendar month. */
  actionItemsPerMonth: number;
  /** New client conversations per calendar month. */
  conversationsPerMonth: number;
  /** Model spend per calendar month, USD, at list price. */
  modelCostUsdPerMonth: number;
  /** Runs an organisation may start per rolling hour. */
  runsPerHour: number;
  /** Client messages across all of an organisation's agents per rolling minute. */
  chatMessagesPerMinute: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** USD per month; 0 for the free tier. */
  priceUsd: number;
  blurb: string;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    blurb: "One live agent, enough to see it work.",
    limits: {
      publishedAgents: 1,
      actionItemsPerMonth: 50,
      conversationsPerMonth: 200,
      modelCostUsdPerMonth: 5,
      runsPerHour: 10,
      chatMessagesPerMinute: 30,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 49,
    blurb: "A small team's AI staff.",
    limits: {
      publishedAgents: 3,
      actionItemsPerMonth: 500,
      conversationsPerMonth: 2_000,
      modelCostUsdPerMonth: 40,
      runsPerHour: 60,
      chatMessagesPerMinute: 120,
    },
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceUsd: 199,
    blurb: "A department of agents, working around the clock.",
    limits: {
      publishedAgents: 10,
      actionItemsPerMonth: 3_000,
      conversationsPerMonth: 10_000,
      modelCostUsdPerMonth: 200,
      runsPerHour: 300,
      chatMessagesPerMinute: 600,
    },
  },
};

/**
 * A deployment with no billing has no way to upgrade, so it has no caps:
 * limits exist to meter paying customers, not to hobble a self-hosted
 * install. Enforcement is on when Stripe is configured, or explicitly.
 */
export const SELF_HOSTED: Plan = {
  id: "free",
  name: "Self-hosted",
  priceUsd: 0,
  blurb: "No billing configured; no limits.",
  limits: {
    publishedAgents: Number.MAX_SAFE_INTEGER,
    actionItemsPerMonth: Number.MAX_SAFE_INTEGER,
    conversationsPerMonth: Number.MAX_SAFE_INTEGER,
    modelCostUsdPerMonth: Number.MAX_SAFE_INTEGER,
    runsPerHour: Number.MAX_SAFE_INTEGER,
    chatMessagesPerMinute: Number.MAX_SAFE_INTEGER,
  },
};

export function limitsEnforced(): boolean {
  return (
    Boolean(process.env.STRIPE_SECRET_KEY?.trim()) || process.env.ENFORCE_PLAN_LIMITS === "true"
  );
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function planFor(id: string | null | undefined): Plan {
  if (!limitsEnforced()) return SELF_HOSTED;
  return isPlanId(id ?? "") ? PLANS[id as PlanId] : PLANS.free;
}
