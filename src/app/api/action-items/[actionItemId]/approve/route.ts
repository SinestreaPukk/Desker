import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { approveItem } from "@/lib/work/decide";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A human releases the pending external action. Delivery happens in the job runtime. */
export async function POST(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({ where: { id: actionItemId, agent: agentsVisibleTo(userId) }, select: { id: true } });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    await approveItem(actionItemId, userId);
    return toActionItemDto(await prisma.actionItem.findUniqueOrThrow({ where: { id: actionItemId }, include: actionItemInclude }));
  });
}
