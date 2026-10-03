import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { listLogins, removeLogin, revealLogin } from "@/lib/life/details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function projectFor(handle_: string | null, userId: string) {
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That project no longer exists.");
  return project;
}

const revealSchema = z.object({ project: z.string().min(1), site: z.string().min(1) });

/** Shows one password, only when the person asks for it, and never caches it. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, revealSchema);
    const project = await projectFor(input.project, userId);
    const login = await revealLogin(project.id, input.site);
    if (!login) throw new HttpError(404, "That login no longer exists.");
    return { username: login.username, password: login.password };
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const params = new URL(request.url).searchParams;
    const project = await projectFor(params.get("project"), userId);
    await removeLogin(project.id, params.get("site") ?? "");
    return { logins: await listLogins(project.id) };
  });
}
