import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { listDetails, listLogins, removeDetail, setDetail } from "@/lib/life/details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function projectFor(handle_: string | null, userId: string) {
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That project no longer exists.");
  return project;
}

/** What it may fill into forms, and the sites it has logins for (never the passwords). */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await projectFor(new URL(request.url).searchParams.get("project"), userId);
    const [details, logins] = await Promise.all([listDetails(project.id), listLogins(project.id)]);
    return { details, logins };
  });
}

const putSchema = z.object({ project: z.string().min(1), label: z.string().trim().min(1, "Give it a name.").max(60), value: z.string().trim().min(1, "Write the detail.").max(300) });

export async function PUT(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, putSchema);
    const project = await projectFor(input.project, userId);
    await setDetail(project.id, input.label, input.value);
    return { details: await listDetails(project.id) };
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const params = new URL(request.url).searchParams;
    const project = await projectFor(params.get("project"), userId);
    await removeDetail(project.id, params.get("label") ?? "");
    return { details: await listDetails(project.id) };
  });
}
