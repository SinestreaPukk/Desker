import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findAgentFor } from "@/lib/projects";
import { inngest } from "@/lib/jobs/client";
import { generateDigest } from "@/lib/work/digest";
import { afterResponse } from "@/lib/after-response";
import { heartbeatStatus } from "@/lib/jobs/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Send me one now": builds this agent's digest out of band, covering
 * everything since its last one. It makes a model call and may send an email,
 * so it goes to the job runtime rather than blocking the click - and writes it
 * after the response instead when there is no runtime to take it, so the
 * button means the same thing in every deployment.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    // Whether the job runtime is actually there decides who does the work.
    // A queued event nobody consumes is indistinguishable from a broken
    // button, so a deployment without a runtime writes the digest itself.
    const runtime = await heartbeatStatus();
    let queued = false;
    try {
      await inngest.send({
        name: "work/digest.generate",
        data: { agentId, organizationId: agent.project.organizationId },
      });
      queued = runtime.alive;
    } catch (error) {
      console.warn("[digest] inngest.send failed; generating after the response:", error);
    }

    if (!queued) {
      afterResponse(async () => {
        try {
          await generateDigest(agentId, { force: true });
        } catch (caught) {
          console.error(`[digest:afterResponse] failed for agent ${agentId}:`, caught);
        }
      });
    }

    return { queued: true };
  });
}
