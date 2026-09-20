import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { integrationId } = await params;
    const row = await prisma.integration.findFirst({
      where: { id: integrationId, organization: { memberships: { some: { userId } } } },
    });
    if (!row) throw new HttpError(404, "That integration no longer exists.");
    await prisma.integration.delete({ where: { id: row.id } });
    await audit({
      organizationId: row.organizationId,
      actorType: "user",
      actorId: userId,
      action: "integration.removed",
      targetType: "integration",
      targetId: row.id,
      metadata: { type: row.type, name: row.name },
    });
    return { ok: true };
  });
}
