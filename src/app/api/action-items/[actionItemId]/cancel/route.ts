import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { transition, InvalidTransition } from "@/lib/work/runner";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calls off a queued or running task. A running one may still finish the step
 * it is on, but the runner only closes out work that is still "in progress",
 * so nothing it does afterwards reopens it.
 */
// ponytail: the agent loop is not interrupted mid-step, it just stops counting; add a status check between steps if cancelled runs burn noticeable tokens.
export async function POST(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: { id: true, status: true, organizationId: true },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    try {
      await transition(actionItemId, "cancelled", { error: "Cancelled by you." });
    } catch (error) {
      if (error instanceof InvalidTransition) {
        throw new HttpError(409, "Only queued or running work can be cancelled.");
      }
      throw error;
    }
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.cancelled",
      targetType: "action_item",
      targetId: actionItemId,
      metadata: { from: item.status },
    });
    const fresh = await prisma.actionItem.findUniqueOrThrow({ where: { id: actionItemId }, include: actionItemInclude });
    return toActionItemDto(fresh);
  });
}
