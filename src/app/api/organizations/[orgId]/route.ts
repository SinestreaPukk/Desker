import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { membershipOf, requireRole } from "@/lib/organizations";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { orgId } = await params;
    const role = await membershipOf(userId, orgId);
    if (!role) throw new HttpError(404, "That organisation no longer exists.");
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, plan: true, mailingAddress: true, createdAt: true, _count: { select: { memberships: true, projects: true } } },
    });
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      mailingAddress: org.mailingAddress,
      role,
      members: org._count.memberships,
      projects: org._count.projects,
      createdAt: org.createdAt.toISOString(),
    };
  });
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    /** Printed on every agent email; "" clears it. */
    mailingAddress: z.string().trim().max(300).optional(),
  })
  .refine((input) => input.name !== undefined || input.mailingAddress !== undefined, "Nothing to change.");

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { orgId } = await params;
    await requireRole(userId, orgId, "owner");
    const input = await parseJson(request, patchSchema);
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.mailingAddress !== undefined ? { mailingAddress: input.mailingAddress || null } : {}),
      },
    });
    if (input.name !== undefined) {
      await audit({
        organizationId: orgId,
        actorType: "user",
        actorId: userId,
        action: "organization.renamed",
        targetType: "organization",
        targetId: orgId,
        metadata: { name: org.name },
      });
    }
    if (input.mailingAddress !== undefined) {
      await audit({
        organizationId: orgId,
        actorType: "user",
        actorId: userId,
        action: "organization.mailing_address_updated",
        targetType: "organization",
        targetId: orgId,
      });
    }
    return { id: org.id, name: org.name, mailingAddress: org.mailingAddress };
  });
}
