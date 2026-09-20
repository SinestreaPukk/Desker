import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ documentId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { documentId } = await params;

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new HttpError(404, "That document no longer exists.");

    // Remove the row first: an orphaned blob is recoverable, a chunk pointing at
    // a deleted file is not.
    await prisma.document.delete({ where: { id: documentId } });
    await getStorage()
      .delete(document.storageKey)
      .catch((error) => console.error("[documents] blob cleanup failed", error));

    return { ok: true };
  });
}
