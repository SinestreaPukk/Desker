import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { transition, InvalidTransition } from "@/lib/work/runner";
import { rejectSchema } from "@/lib/work/validation";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const input = await parseJson(request, rejectSchema);
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: { id: true, organizationId: true, pendingAction: true },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");

    const reason = input.reason?.trim() || "Rejected by an owner.";
    try {
      await transition(actionItemId, "rejected", { error: reason });
    } catch (error) {
      if (error instanceof InvalidTransition) throw new HttpError(409, error.message);
      throw error;
    }
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.rejected",
      targetType: "action_item",
      targetId: actionItemId,
      metadata: { reason, tool: (item.pendingAction as { tool?: string } | null)?.tool ?? null },
    });

    const fresh = await prisma.actionItem.findUniqueOrThrow({
      where: { id: actionItemId },
      include: actionItemInclude,
    });
    return toActionItemDto(fresh);
  });
}
