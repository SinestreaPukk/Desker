import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { transition, InvalidTransition } from "@/lib/work/runner";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Undo a rejection: the item goes back to waiting for a decision. */
export async function POST(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: { id: true, organizationId: true, pendingAction: true },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    if (!item.pendingAction) throw new HttpError(409, "There is nothing to reopen on this task.");
    try {
      await transition(actionItemId, "needs_approval", { error: null, completedAt: null });
    } catch (error) {
      if (error instanceof InvalidTransition) throw new HttpError(409, error.message);
      throw error;
    }
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.reopened",
      targetType: "action_item",
      targetId: actionItemId,
    });
    const fresh = await prisma.actionItem.findUniqueOrThrow({ where: { id: actionItemId }, include: actionItemInclude });
    return toActionItemDto(fresh);
  });
}
