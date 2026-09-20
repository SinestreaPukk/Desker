import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
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
