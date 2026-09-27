import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { toActionItemDto, actionItemInclude } from "../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      include: actionItemInclude,
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    return toActionItemDto(item);
  });
}

/**
 * Removes a run and what hangs off it (its issues; drafts and suggestions stay,
 * unlinked). Not while it is in flight: the runner is still writing to it -
 * cancel it first.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: { id: true, status: true, organizationId: true, headline: true, payload: true },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    if (IN_FLIGHT.has(item.status)) {
      throw new HttpError(409, "This run is still going. Cancel it first, then remove it.");
    }
    await prisma.actionItem.delete({ where: { id: actionItemId } });
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.deleted",
      targetType: "action_item",
      targetId: actionItemId,
      // A queued run has no headline yet; its task says what it was.
      metadata: {
        status: item.status,
        headline: item.headline ?? (item.payload as { objective?: string } | null)?.objective ?? null,
      },
    });
    return { ok: true };
  });
}

const IN_FLIGHT = new Set(["in_progress", "approved", "executing_external"]);
