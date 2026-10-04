import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { updateCommitment } from "@/lib/commitments/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; commitmentId: string }> };

const patchCommitmentSchema = z.object({
  outcome: z.string().trim().min(1).max(500).optional(),
  dueAt: z.string().nullable().optional(),
  status: z.enum(["open", "waiting", "snoozed", "done", "dropped"]).optional(),
  snoozedUntil: z.string().nullable().optional(),
  note: z.string().trim().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId, commitmentId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, patchCommitmentSchema);
    try {
      const commitment = await updateCommitment({
        id: commitmentId,
        projectId: project.id,
        outcome: input.outcome,
        dueAt: input.dueAt,
        status: input.status,
        snoozedUntil: input.snoozedUntil,
        note: input.note,
      });
      return { commitment };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not update commitment.");
    }
  });
}
