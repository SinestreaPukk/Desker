import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { requireRole } from "@/lib/organizations";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ project: z.string().min(1) });

/** Opens Stripe's hosted portal: change plan, update card, see invoices. Owners only. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, schema);
    const project = await findProject(input.project, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "owner");
    if (!stripeConfigured()) throw new HttpError(503, "Billing is not configured on this server.");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: project.organizationId },
      select: { stripeCustomerId: true },
    });
    if (!org.stripeCustomerId) {
      throw new HttpError(409, "This organisation has no billing account yet. Choose a plan first.");
    }
    const origin = env.appUrl || new URL(request.url).origin;
    const session = await stripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${origin}/p/${project.slug}/organization`,
    });
    return { url: session.url };
  });
}
