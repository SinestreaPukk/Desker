import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { requireRole } from "@/lib/organizations";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ orgId: string; inviteId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { orgId, inviteId } = await params;
    await requireRole(userId, orgId, "admin");
    const row = await prisma.invitation.findFirst({ where: { id: inviteId, organizationId: orgId } });
    if (!row) throw new HttpError(404, "That invitation no longer exists.");
    await prisma.invitation.delete({ where: { id: row.id } });
    await audit({
      organizationId: orgId,
      actorType: "user",
      actorId: userId,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: row.id,
      metadata: { email: row.email },
    });
    return { ok: true };
  });
}
