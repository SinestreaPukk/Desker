import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { projectsVisibleTo } from "@/lib/projects";
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

/** One chat's messages, oldest first. */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { threadId } = await params;
    if (!(await visibleThread(threadId, userId))) throw new HttpError(404, "That chat no longer exists.");
    const rows = await prisma.teamMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: messageSelect,
    });
    return rows.map(toMessageDto);
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
