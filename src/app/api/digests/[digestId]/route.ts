import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { digestPatchSchema } from "@/lib/work/validation";
import { digestInclude, toDigestDto } from "../serialize";

export const runtime = "nodejs";

type Params = { params: Promise<{ digestId: string }> };

/** Read or unread. Tenancy goes through the agent, the same as the list route. */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { digestId } = await params;
    const input = await parseJson(request, digestPatchSchema);

    const existing = await prisma.digest.findFirst({
      where: { id: digestId, agent: agentsVisibleTo(userId) },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "That update no longer exists.");

    const digest = await prisma.digest.update({
      where: { id: existing.id },
      data: { readAt: input.read ? new Date() : null },
      include: digestInclude,
    });
    return toDigestDto(digest);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { digestId } = await params;
    const row = await prisma.digest.findFirst({
      where: { id: digestId, agent: agentsVisibleTo(userId) },
      select: { id: true, organizationId: true },
    });
    if (!row) throw new HttpError(404, "That update no longer exists.");
    await prisma.digest.delete({ where: { id: digestId } });
    await audit({
      organizationId: row.organizationId,
      actorType: "user",
      actorId: userId,
      action: "digest.deleted",
      targetType: "digest",
      targetId: digestId,
    });
    return { ok: true };
  });
}
