import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { listCommitments, createCommitment } from "@/lib/commitments/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

const createCommitmentSchema = z.object({
  type: z.enum(["to_do", "waiting_on", "recurring"]),
  outcome: z.string().trim().min(1).max(500),
  dueAt: z.string().optional(),
  ownerRole: z.enum(["user", "other"]).optional(),
  ownerName: z.string().trim().optional(),
  sourceRef: z.string().optional(),
  checkSignal: z.string().optional(),
});

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const type = (url.searchParams.get("type") as "to_do" | "waiting_on" | "recurring") || undefined;

    const items = await listCommitments(project.id, { status, type });
    return { commitments: items };
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, createCommitmentSchema);
    try {
      const commitment = await createCommitment({
        projectId: project.id,
        type: input.type,
        outcome: input.outcome,
        dueAt: input.dueAt,
        ownerRole: input.ownerRole,
        ownerName: input.ownerName,
        sourceRef: input.sourceRef,
        checkSignal: input.checkSignal,
      });
      return { commitment };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not create commitment.");
    }
  });
}
