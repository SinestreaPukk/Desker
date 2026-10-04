import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { switchClassification } from "@/lib/capture/pipeline";
import type { CaptureClassification } from "@/lib/capture/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; capturedItemId: string }> };

const switchSchema = z.object({
  newClassification: z.enum(["task", "event", "bill", "note", "question", "vault_file"]),
});

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId, capturedItemId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, switchSchema);
    const result = await switchClassification(
      capturedItemId,
      input.newClassification as CaptureClassification,
    );

    if (!result.ok) {
      throw new HttpError(400, result.message);
    }

    return result;
  });
}
