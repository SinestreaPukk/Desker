import { prisma } from "@/lib/platform/db";
import { agentsVisibleTo } from "@/lib/tenancy/projects";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { storage } from "@/lib/platform/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ documentId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { documentId } = await params;

    // Only a document belonging to an agent the caller can see.
    const document = await prisma.document.findFirst({
      where: { id: documentId, agent: agentsVisibleTo(userId) },
    });
    if (!document) throw new HttpError(404, "That document no longer exists.");

    // Remove the row first: an orphaned blob is recoverable, a chunk pointing at
    // a deleted file is not.
    await prisma.document.delete({ where: { id: documentId } });
    await storage
      .delete(document.storageKey)
      .catch((error) => console.error("[documents] blob cleanup failed", error));

    return { ok: true };
  });
}
