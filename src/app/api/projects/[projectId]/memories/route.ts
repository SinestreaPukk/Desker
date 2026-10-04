import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { listMemories, saveMemory } from "@/lib/memory/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

const createMemorySchema = z.object({
  fact: z.string().trim().min(1).max(500),
  kind: z.enum(["preference", "person", "routine", "standing_instruction", "fact"]).optional(),
  personName: z.string().trim().optional(),
  relationship: z.string().trim().optional(),
  inferred: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const memories = await listMemories(project.id);
    return { memories };
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, createMemorySchema);
    try {
      const result = await saveMemory({
        projectId: project.id,
        fact: input.fact,
        kind: input.kind,
        personName: input.personName,
        relationship: input.relationship,
        inferred: input.inferred,
        source: input.inferred ? "inferred" : "user",
      });
      return result;
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not save memory.");
    }
  });
}
