import { prisma } from "@/lib/db";
import { limitOrganization } from "@/lib/rate-limit";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { contextQuestions } from "@/lib/work/context";
import { NoDocuments, NoModel, draftContextFromDocuments } from "@/lib/work/context-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ projectId: string }> };

/**
 * Proposes answers to the project's shared questions from every processed
 * document in the project. Nothing is saved: the draft goes back to the form
 * for the owner to edit and save themselves.
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const project = await findProject(projectId, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");

    // Whichever agent is doing the reading pays for it and picks the model;
    // the newest published agent is the one most likely to be configured.
    const agent = await prisma.agent.findFirst({
      where: { projectId: project.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: { id: true, modelProvider: true, model: true },
    });

    await limitOrganization(project.organizationId, "model");
    try {
      return await draftContextFromDocuments({
        organizationId: project.organizationId,
        projectId: project.id,
        questions: contextQuestions().all,
        model: { provider: agent?.modelProvider ?? "anthropic", name: agent?.model ?? null },
        billingAgentId: agent?.id,
      });
    } catch (error) {
      if (error instanceof NoDocuments) throw new HttpError(409, error.message);
      if (error instanceof NoModel) throw new HttpError(503, error.message);
      throw error;
    }
  });
}
