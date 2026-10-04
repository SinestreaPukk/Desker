import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { projectsVisibleTo } from "@/lib/tenancy/projects";
import { messageSelect, toMessageDto } from "../serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

/** Null unless the chat is in a project the caller can see. */
async function visibleThread(threadId: string, userId: string) {
  return prisma.teamThread.findFirst({
    where: { id: threadId, project: projectsVisibleTo(userId) },
    select: { id: true },
  });
}

/** One chat's latest messages, oldest first. */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { threadId } = await params;
    if (!(await visibleThread(threadId, userId))) throw new HttpError(404, "That chat no longer exists.");
    const rows = await prisma.teamMessage.findMany({
      where: { threadId },
      // The newest 200: the chat polls this, so a long history must not be re-sent whole every few seconds.
      orderBy: { createdAt: "desc" },
      take: 200,
      select: messageSelect,
    });
    return rows.reverse().map(toMessageDto);
  });
}

/** Deletes a chat and its messages. Tasks it started stay in Work. */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { threadId } = await params;
    if (!(await visibleThread(threadId, userId))) throw new HttpError(404, "That chat no longer exists.");
    await prisma.teamThread.delete({ where: { id: threadId } });
    return { ok: true };
  });
}
