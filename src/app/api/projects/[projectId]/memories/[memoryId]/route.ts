import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { updateMemory, deleteMemory } from "@/lib/memory/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; memoryId: string }> };

const patchMemorySchema = z.object({
  fact: z.string().trim().min(1).max(500).optional(),
  kind: z.enum(["preference", "person", "routine", "standing_instruction", "fact"]).optional(),
  status: z.enum(["confirmed", "pending_confirmation", "rejected"]).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId, memoryId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, patchMemorySchema);
    try {
      const memory = await updateMemory(memoryId, project.id, input);
      return { memory };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not update memory.");
    }
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId, memoryId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    await deleteMemory(memoryId, project.id);
    return { ok: true };
  });
}
