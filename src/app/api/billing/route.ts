import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { membershipOf } from "@/lib/organizations";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/billing/plans";
import { usageSnapshot } from "@/lib/billing/usage";
import { priceIdFor, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The billing page in one read: plan, limits, month-to-date usage, what Stripe offers. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const projectHandle = new URL(request.url).searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (!project) throw new HttpError(404, "That project no longer exists.");
    const role = await membershipOf(userId, project.organizationId);
    if (!role) throw new HttpError(403, "You are not a member of that organisation.");

    const [org, usage] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: project.organizationId },
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          stripeCustomerId: true,
        },
      }),
      usageSnapshot(project.organizationId),
    ]);

    return {
      organization: { id: org.id, name: org.name },
      role,
      plan: usage.plan,
      subscriptionStatus: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
      hasPaymentMethod: Boolean(org.stripeCustomerId),
      usage: {
        period: usage.period,
        publishedAgents: usage.publishedAgents,
        actionItems: usage.actionItems,
        conversations: usage.conversations,
        modelCostUsd: usage.modelCostUsd,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        searches: usage.searches,
      },
      plans: Object.values(PLANS).map((plan) => ({
        ...plan,
        purchasable: plan.id === "free" ? false : stripeConfigured() && Boolean(priceIdFor(plan.id)),
      })),
      stripeConfigured: stripeConfigured(),
    };
  });
}
