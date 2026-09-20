import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { draftPatchSchema } from "@/lib/work/validation";
import type { DraftDto } from "@/lib/work/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * An owner edits what the agent wrote before approving it. Only a draft that
 * has not gone out can change; the edit is on the record so the audit trail
 * shows what the agent wrote and what a person changed.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { draftId } = await params;
    const input = await parseJson(request, draftPatchSchema);

    const draft = await prisma.draft.findFirst({
      where: { id: draftId, agent: agentsVisibleTo(userId) },
    });
    if (!draft) throw new HttpError(404, "That draft no longer exists.");
    if (draft.status !== "draft") throw new HttpError(409, "That draft has already gone out.");

    const metadata = { ...((draft.metadata as Record<string, unknown> | null) ?? {}) };
    if (input.to !== undefined) metadata.to = input.to;
    if (input.title !== undefined && draft.kind === "email") metadata.subject = input.title;

    const updated = await prisma.draft.update({
      where: { id: draft.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    // The pending action carries the recipients and subject it will send with;
    // keep it in step with the edited draft.
    if (draft.actionItemId && draft.kind === "email") {
      const item = await prisma.actionItem.findUnique({
        where: { id: draft.actionItemId },
        select: { pendingAction: true },
      });
      const pending = item?.pendingAction as { tool?: string; input?: Record<string, unknown> } | null;
      if (pending?.tool === "send_email" && pending.input?.draft_id === draft.id) {
        const to =
          typeof metadata.to === "string"
            ? metadata.to.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
            : pending.input.to;
        await prisma.actionItem.update({
          where: { id: draft.actionItemId },
          data: {
            pendingAction: {
              ...pending,
              input: { ...pending.input, to, subject: updated.title },
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    await audit({
      organizationId: draft.organizationId,
      actorType: "user",
      actorId: userId,
      action: "draft.edited",
      targetType: "draft",
      targetId: draft.id,
      metadata: {
        actionItemId: draft.actionItemId,
        changed: Object.keys(input),
        before: { title: draft.title, body: draft.body.slice(0, 600) },
        after: { title: updated.title, body: updated.body.slice(0, 600) },
      },
    });

    const dto: DraftDto = {
      id: updated.id,
      kind: updated.kind,
      title: updated.title,
      body: updated.body,
      metadata: (updated.metadata as Record<string, unknown> | null) ?? null,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
    return dto;
  });
}
