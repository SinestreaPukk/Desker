/**
 * Per-organisation token metering.
 *
 * Every model call - chat turns, summaries, and later the autonomous work
 * loop - lands here. Counts are bucketed by UTC month, provider, model and
 * agent, so billing can read a month total per organisation and insights can
 * break the same numbers down per agent, from one table.
 *
 * Recording never throws: the tokens have already been spent, and a metering
 * hiccup must not turn into a failed reply for a client.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** What a model call must carry so its cost can be attributed. */
export interface BillingContext {
  organizationId: string;
  agentId?: string | null;
}

export interface UsageSample extends BillingContext {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** YYYY-MM in UTC. */
export function usagePeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function recordTokenUsage(sample: UsageSample): Promise<void> {
  const key = {
    organizationId: sample.organizationId,
    period: usagePeriod(),
    provider: sample.provider,
    model: sample.model,
    agentId: sample.agentId ?? "",
  };
  const increment = {
    inputTokens: { increment: sample.inputTokens },
    outputTokens: { increment: sample.outputTokens },
    calls: { increment: 1 },
  };

  // Two concurrent first calls in a new bucket can both miss on the upsert's
  // read and one of them will hit the unique index; retrying once resolves it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.usageCounter.upsert({
        where: { organizationId_period_provider_model_agentId: key },
        create: {
          ...key,
          inputTokens: sample.inputTokens,
          outputTokens: sample.outputTokens,
          calls: 1,
        },
        update: increment,
      });
      return;
    } catch (error) {
      const conflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!conflict || attempt === 1) {
        console.error("[usage] failed to record token usage", error);
        return;
      }
    }
  }
}

/** Month-to-date totals for one organisation, for billing and the health of a plan. */
export async function usageForOrganization(organizationId: string, period = usagePeriod()) {
  const totals = await prisma.usageCounter.aggregate({
    where: { organizationId, period },
    _sum: { inputTokens: true, outputTokens: true, calls: true },
  });
  return {
    period,
    inputTokens: totals._sum.inputTokens ?? 0,
    outputTokens: totals._sum.outputTokens ?? 0,
    calls: totals._sum.calls ?? 0,
  };
}
