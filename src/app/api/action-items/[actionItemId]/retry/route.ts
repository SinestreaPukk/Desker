import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { agentsVisibleTo } from "@/lib/tenancy/projects";
import { audit } from "@/lib/platform/audit";
import { RunRefused, dispatchRun, startRun } from "@/lib/work/scope";
import { workflowTag } from "@/lib/work/workflow-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The recovery action for a failed run. A failed run stays failed - that is
 * the record - and the retry is a new one:
 *
 * - If the work finished but sending failed (it had been approved), the same
 *   send goes back to Needs you for a fresh yes, once the cause is fixed. The
 *   work is not redone.
 * - Otherwise the run starts again with the same instruction.
 *
 * Either way the failure is marked handled, so it leaves Needs you.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { actionItemId } = await params;
    const item = await prisma.actionItem.findFirst({
      where: { id: actionItemId, agent: agentsVisibleTo(userId) },
      select: {
        id: true,
        organizationId: true,
        agentId: true,
        status: true,
        type: true,
        trigger: true,
        payload: true,
        headline: true,
        summary: true,
        pendingAction: true,
        approvedAt: true,
        parentId: true,
      },
    });
    if (!item) throw new HttpError(404, "That task no longer exists.");
    if (item.status !== "failed") throw new HttpError(409, "Only a failed run can be retried.");

    let retryId: string;
    let resend = false;
    if (item.approvedAt && item.pendingAction) {
      resend = true;
      const copy = await prisma.actionItem.create({
        data: {
          organizationId: item.organizationId,
          agentId: item.agentId,
          type: item.type,
          trigger: "manual",
          payload: { ...((item.payload as Record<string, unknown>) ?? {}), retryOf: item.id } as Prisma.InputJsonValue,
          status: "needs_approval",
          awaitingSince: new Date(),
          headline: item.headline,
          summary: item.summary,
          pendingAction: item.pendingAction as Prisma.InputJsonValue,
          parentId: item.id,
        },
        select: { id: true },
      });
      retryId = copy.id;
    } else if (item.trigger === "delegation") {
      // A hand-off (or a workflow step) runs again as the same hand-off, with
      // the same brief and findings from the step before.
      const copy = await prisma.actionItem.create({
        data: {
          organizationId: item.organizationId,
          agentId: item.agentId,
          type: item.type,
          trigger: item.trigger,
          parentId: item.parentId,
          payload: { ...((item.payload as Record<string, unknown>) ?? {}), retryOf: item.id } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await dispatchRun(copy.id, item.organizationId);
      retryId = copy.id;
    } else {
      const payload = (item.payload as Record<string, unknown>) ?? {};
      const tag = workflowTag(payload);
      try {
        const run = await startRun({
          agentId: item.agentId,
          trigger: "manual",
          payload: {
            ...(typeof payload.instruction === "string" ? { instruction: payload.instruction } : {}),
            // A retried first step stays part of its workflow.
            ...(tag ? { workflow: { ...tag, rootId: tag.rootId ?? item.id } } : {}),
            retryOf: item.id,
          },
          actor: { type: "user", id: userId },
        });
        if (!run) throw new HttpError(404, "That agent no longer exists.");
        retryId = run.id;
      } catch (error) {
        if (error instanceof RunRefused) throw new HttpError(429, error.message);
        throw error;
      }
    }

    await prisma.issue.updateMany({
      where: { actionItemId: item.id, status: "open", type: "failure" },
      data: { status: "resolved" },
    });
    await audit({
      organizationId: item.organizationId,
      actorType: "user",
      actorId: userId,
      action: "action_item.retried",
      targetType: "action_item",
      targetId: item.id,
      metadata: { retryId, resend },
    });
    return { id: retryId, resend };
  });
}
