import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { closeCommitment } from "@/lib/commitments/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; commitmentId: string }> };

const closeCommitmentSchema = z.object({
  status: z.enum(["done", "dropped"]),
  reason: z.string().trim().optional(),
});

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId, commitmentId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, closeCommitmentSchema);
    try {
      const commitment = await closeCommitment(commitmentId, project.id, input.status, input.reason);
      return { commitment };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not close commitment.");
    }
  });
}
