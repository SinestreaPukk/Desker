import { prisma } from "@/lib/platform/db";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { findAgentFor } from "@/lib/tenancy/projects";
import { contextQuestions } from "@/lib/work/context";
import { NoDocuments, NoModel, draftContextFromDocuments } from "@/lib/work/context-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/**
 * Proposes answers to this agent's context questions from the documents it
 * has been given. Nothing is saved - the owner edits the draft and saves the
 * scope of work as usual.
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const model = await prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      select: { modelProvider: true, model: true },
    });

    await limitOrganization(agent.project.organizationId, "model");
    try {
      return await draftContextFromDocuments({
        organizationId: agent.project.organizationId,
        agentId,
        questions: contextQuestions().agent,
        model: { provider: model.modelProvider, name: model.model },
        billingAgentId: agentId,
      });
    } catch (error) {
      if (error instanceof NoDocuments) throw new HttpError(409, error.message);
      if (error instanceof NoModel) throw new HttpError(503, error.message);
      throw error;
    }
  });
}
