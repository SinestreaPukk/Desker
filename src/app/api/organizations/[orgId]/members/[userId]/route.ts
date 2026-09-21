import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { requireRole } from "@/lib/organizations";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgId: string; userId: string }> };

const roleSchema = z.object({ role: z.enum(["owner", "admin", "member"]) });

/** An organisation must always keep at least one owner. */
async function assertNotLastOwner(orgId: string, userId: string) {
  const target = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  if (!target) throw new HttpError(404, "That person is not a member.");
  if (target.role === "owner") {
    const owners = await prisma.membership.count({ where: { organizationId: orgId, role: "owner" } });
    if (owners <= 1) throw new HttpError(409, "An organisation needs at least one owner. Make someone else an owner first.");
  }
  return target;
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId: actorId } = await requireAdmin();
    const { orgId, userId } = await params;
    await requireRole(actorId, orgId, "owner");
    const input = await parseJson(request, roleSchema);
    const target = await assertNotLastOwner(orgId, userId);
    if (target.role === input.role) return { userId, role: input.role };
    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { role: input.role },
    });
    await audit({
      organizationId: orgId,
      actorType: "user",
      actorId,
      action: "membership.role_changed",
      targetType: "user",
      targetId: userId,
      metadata: { from: target.role, to: input.role },
    });
    return { userId, role: input.role };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId: actorId } = await requireAdmin();
    const { orgId, userId } = await params;
    // Anyone may leave; removing someone else takes an owner.
    if (userId !== actorId) await requireRole(actorId, orgId, "owner");
    await assertNotLastOwner(orgId, userId);
    await prisma.membership.delete({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    await audit({
      organizationId: orgId,
      actorType: "user",
      actorId,
      action: userId === actorId ? "membership.left" : "membership.removed",
      targetType: "user",
      targetId: userId,
    });
    return { ok: true };
  });
}
