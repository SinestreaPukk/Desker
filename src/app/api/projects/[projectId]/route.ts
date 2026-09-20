import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { uniqueSlug, findProjectById, projectsVisibleTo } from "@/lib/projects";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Renaming keeps the slug by default, so existing links keep working. */
  reslug: z.boolean().default(false),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const input = await parseJson(request, patchSchema);

    const existing = await findProjectById(projectId, userId);
    if (!existing) throw new HttpError(404, "That project no longer exists.");

    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        ...(input.reslug ? { slug: await uniqueSlug(input.name) } : {}),
      },
    });

    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "project.updated",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name, slug: project.slug },
    });

    return { id: project.id, name: project.name, slug: project.slug };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;

    const project = await findProjectById(projectId, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");

    // Refuse to delete the last project: the admin would be left with chrome
    // and nowhere to go.
    const total = await prisma.project.count({ where: projectsVisibleTo(userId) });
    if (total <= 1) {
      throw new HttpError(
        409,
        "This is your only project, so it can't be deleted. Create another one first.",
      );
    }

    // Cascades to agents, and through them to documents, conversations and
    // issues.
    await prisma.project.delete({ where: { id: project.id } });

    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "project.deleted",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name, slug: project.slug },
    });

    return { ok: true };
  });
}
