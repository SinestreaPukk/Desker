import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { track } from "@/lib/product-events";
import { inngest } from "@/lib/jobs/client";
import { transition, InvalidTransition } from "@/lib/work/runner";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A human releases the pending external action. Delivery happens in the job runtime. */
export async function POST(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: { id: true, organizationId: true, pendingAction: true, status: true },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    if (!item.pendingAction) throw new HttpError(409, "There is nothing waiting for approval on this task.");

    try {
      await transition(actionItemId, "approved", { approvedById: userId, approvedAt: new Date() });
    } catch (error) {
      if (error instanceof InvalidTransition) throw new HttpError(409, error.message);
      throw error;
    }
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.approved",
      targetType: "action_item",
      targetId: actionItemId,
      metadata: { tool: (item.pendingAction as { tool?: string }).tool ?? null },
    });

    try {
      await inngest.send({
        name: "work/action-item.execute",
        data: { actionItemId, organizationId: item.organizationId },
      });
    } catch (error) {
      await transition(actionItemId, "failed", {
        error: `Approved, but the job runtime could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }

    await track({ name: "approval.approved", organizationId: item.organizationId, userId, metadata: { tool: (item.pendingAction as { tool?: string } | null)?.tool ?? "" } });

    const fresh = await prisma.actionItem.findUniqueOrThrow({
      where: { id: actionItemId },
      include: actionItemInclude,
    });
    return toActionItemDto(fresh);
  });
}
