import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { readProjectContext, saveProjectContext } from "@/lib/work/project-context";
import { projectContextSchema } from "@/lib/work/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ projectId: string }> };

/** Accepts the slug as well as the id, so the roster can use what is in its URL. */
async function resolve(handleOrId: string, userId: string) {
  const project = await findProject(handleOrId, userId);
  if (!project) throw new HttpError(404, "That project no longer exists.");
  return project;
}

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const project = await resolve(projectId, userId);
    return readProjectContext(project);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const input = await parseJson(request, projectContextSchema);
    const project = await resolve(projectId, userId);
    return saveProjectContext(project, input.answers, userId);
  });
}
