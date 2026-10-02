import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { rejectItem } from "@/lib/work/decide";
import { rejectSchema } from "@/lib/work/validation";
import { toActionItemDto, actionItemInclude } from "../../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const input = await parseJson(request, rejectSchema);
    const item = await prisma.actionItem.findFirst({ where: { id: actionItemId, agent: agentsVisibleTo(userId) }, select: { id: true } });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    await rejectItem(actionItemId, userId, input.reason || undefined);
    return toActionItemDto(await prisma.actionItem.findUniqueOrThrow({ where: { id: actionItemId }, include: actionItemInclude }));
  });
}
