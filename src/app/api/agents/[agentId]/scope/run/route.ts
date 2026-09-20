import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findAgentFor } from "@/lib/projects";
import { startRun } from "@/lib/work/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Run now": starts the agent's scope of work by hand. */
export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const item = await startRun({
      agentId,
      trigger: "manual",
      payload: { startedBy: userId },
      actor: { type: "user", id: userId },
    });
    if (!item) throw new HttpError(500, "Could not start the run.");
    return { id: item.id, status: item.status, error: item.error };
  });
}
