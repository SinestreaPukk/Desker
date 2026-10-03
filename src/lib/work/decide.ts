/**
 * The two decisions a person makes on a waiting action: release it or
 * reject it. One implementation for every surface - the web's Needs you page
 * and a LINE postback both land here - so an approval is the same audited,
 * state-checked step wherever it is tapped. Callers have already established
 * that `userId` may act on the item.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { HttpError } from "@/lib/platform/http-error";
import { audit } from "@/lib/platform/audit";
import { track } from "@/lib/platform/product-events";
import { afterResponse } from "@/lib/platform/after-response";
import { inngest } from "@/lib/jobs/client";
import { discardReplyDraft, mailAccess } from "@/lib/integrations/mail-calendar";
import { transition, InvalidTransition, executeApprovedAction, inlineSteps } from "./runner";

const toolOf = (pending: unknown) => (pending as { tool?: string } | null)?.tool ?? null;

export async function approveItem(actionItemId: string, userId: string): Promise<void> {
  const item = await prisma.actionItem.findUnique({ where: { id: actionItemId }, select: { organizationId: true, pendingAction: true } });
  if (!item) throw new HttpError(404, "That task no longer exists.");
  if (!item.pendingAction) throw new HttpError(409, "There is nothing waiting for approval on this task.");
  try {
    await transition(actionItemId, "approved", { approvedById: userId, approvedAt: new Date() });
  } catch (error) {
    if (error instanceof InvalidTransition) throw new HttpError(409, error.message);
    throw error;
  }
  await audit({
    organizationId: item.organizationId,
    actorType: "user",
    actorId: userId,
    action: "action_item.approved",
    targetType: "action_item",
    targetId: actionItemId,
    metadata: { tool: toolOf(item.pendingAction) },
  });
  try {
    await inngest.send({ name: "work/action-item.execute", data: { actionItemId, organizationId: item.organizationId } });
  } catch (error) {
    console.warn("[approve] inngest.send failed, executing inline via afterResponse:", error);
    afterResponse(async () => {
      try {
        await executeApprovedAction(actionItemId, inlineSteps);
      } catch (err) {
        console.error(`[approve:afterResponse] execution failed for item ${actionItemId}:`, err);
      }
    });
  }
  await track({ name: "approval.approved", organizationId: item.organizationId, userId, metadata: { tool: toolOf(item.pendingAction) ?? "" } });
}

export async function rejectItem(actionItemId: string, userId: string, reason?: string): Promise<void> {
  const item = await prisma.actionItem.findUnique({ where: { id: actionItemId }, select: { organizationId: true, pendingAction: true } });
  if (!item) throw new HttpError(404, "That task no longer exists.");
  const why = reason?.trim() || "Rejected by an owner.";
  try {
    await transition(actionItemId, "rejected", { error: why });
  } catch (error) {
    if (error instanceof InvalidTransition) throw new HttpError(409, error.message);
    throw error;
  }
  await audit({
    organizationId: item.organizationId,
    actorType: "user",
    actorId: userId,
    action: "action_item.rejected",
    targetType: "action_item",
    targetId: actionItemId,
    metadata: { reason: why, tool: toolOf(item.pendingAction) },
  });
  // A rejected reply leaves no draft behind in the owner's mailbox.
  const pending = item.pendingAction as { tool?: string; input?: { mailbox_draft_id?: string } } | null;
  if (pending?.tool === "inbox_reply" && pending.input?.mailbox_draft_id) {
    const access = await mailAccess(item.organizationId);
    if (access) await discardReplyDraft(access, pending.input.mailbox_draft_id);
  }
  await track({ name: "approval.rejected", organizationId: item.organizationId, userId, metadata: { tool: toolOf(item.pendingAction) ?? "" } });
}
