import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { planForPrice, stripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe tells us what changed; we mirror it onto the organisation. The
 * signature check is the whole security model of this route - never skip it.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set." }, { status: 503 });

  const signature = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: `Invalid signature: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(String(session.subscription));
        await applySubscription(subscription, session.client_reference_id ?? undefined);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applySubscription(event.data.object);
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}

async function applySubscription(subscription: Stripe.Subscription, organizationHint?: string) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const org =
    (organizationHint
      ? await prisma.organization.findUnique({ where: { id: organizationHint } })
      : null) ??
    (await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } })) ??
    (subscription.metadata?.organizationId
      ? await prisma.organization.findUnique({ where: { id: subscription.metadata.organizationId } })
      : null);
  if (!org) return;

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const live = ["active", "trialing", "past_due"].includes(subscription.status);
  const plan = live ? (planForPrice(priceId) ?? "free") : "free";
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.status === "canceled" ? null : subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
  await audit({
    organizationId: org.id,
    actorType: "system",
    action: "billing.subscription_updated",
    targetType: "organization",
    targetId: org.id,
    metadata: { plan, status: subscription.status, previousPlan: org.plan },
  });
}
