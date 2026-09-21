import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { requireRole } from "@/lib/organizations";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { priceIdFor, stripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  project: z.string().min(1),
  plan: z.enum(["starter", "growth"]),
});

/** Starts a Stripe Checkout session for a paid plan. Owners only. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const input = await parseJson(request, schema);
    const project = await findProject(input.project, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "owner");

    if (!stripeConfigured()) throw new HttpError(503, "Billing is not configured on this server.");
    const price = priceIdFor(input.plan);
    if (!price) throw new HttpError(503, `The ${input.plan} plan has no Stripe price configured.`);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: project.organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    // One Stripe customer per organisation, created on first checkout.
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        name: org.name,
        email,
        metadata: { organizationId: org.id },
      });
      customerId = customer.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const origin = env.appUrl || new URL(request.url).origin;
    const returnTo = `${origin}/p/${project.slug}/organization`;
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${returnTo}?checkout=success`,
      cancel_url: `${returnTo}?checkout=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: org.id,
      subscription_data: { metadata: { organizationId: org.id, plan: input.plan } },
    });

    await audit({
      organizationId: org.id,
      actorType: "user",
      actorId: userId,
      action: "billing.checkout_started",
      targetType: "organization",
      targetId: org.id,
      metadata: { plan: input.plan },
    });

    return { url: session.url };
  });
}
