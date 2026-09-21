import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentInputSchema } from "@/lib/validation";
import { toAgentDetail } from "@/lib/serialize";
import { findAgentFor } from "@/lib/projects";
import { canPublishAgent } from "@/lib/billing/limits";
import { track } from "@/lib/product-events";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { agentId } = await params;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    return toAgentDetail(agent);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    // Partial so the roster grid can publish/unpublish without resending the form.
    const input = await parseJson(request, agentInputSchema.partial());

    const existing = await findAgentFor(agentId, userId);
    if (!existing) throw new HttpError(404, "That agent no longer exists.");

    // Going live is where a plan's agent count is enforced.
    if (input.status === "published" && existing.status !== "published") {
      const check = await canPublishAgent(existing.project.organizationId, agentId);
      if (!check.allowed) throw new HttpError(402, check.reason!);
    }

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.department !== undefined ? { department: input.department || null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
        ...(input.personality !== undefined ? { personality: input.personality } : {}),
        ...(input.responsibilities !== undefined
          ? { responsibilities: input.responsibilities }
          : {}),
        ...(input.allowedTools !== undefined ? { allowedTools: input.allowedTools } : {}),
        ...(input.escalationRule !== undefined
          ? { escalationRule: input.escalationRule || null }
          : {}),
        ...(input.welcomeMessage !== undefined
          ? { welcomeMessage: input.welcomeMessage || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.modelProvider !== undefined ? { modelProvider: input.modelProvider } : {}),
        ...(input.model !== undefined ? { model: input.model || null } : {}),
        ...(input.publicPasscode !== undefined
          ? { publicPasscode: input.publicPasscode || null }
          : {}),
        ...(input.widgetLabel !== undefined ? { widgetLabel: input.widgetLabel || null } : {}),
        ...(input.widgetColor !== undefined ? { widgetColor: input.widgetColor || null } : {}),
        ...(input.widgetSide !== undefined ? { widgetSide: input.widgetSide ?? null } : {}),
      },
    });

    // Publishing is the moment a plan and a product decision both hinge on;
    // record it in the trail and in the usage events.
    if (input.status !== undefined && input.status !== existing.status) {
      await audit({
        organizationId: existing.project.organizationId,
        actorType: "user",
        actorId: userId,
        action: input.status === "published" ? "agent.published" : "agent.unpublished",
        targetType: "agent",
        targetId: agentId,
      });
      await track({
        name: input.status === "published" ? "agent.published" : "agent.unpublished",
        organizationId: existing.project.organizationId,
        userId,
      });
    }

    return toAgentDetail(agent);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { agentId } = await params;

    // Cascades to documents, chunks, conversations, messages and issues.
    await prisma.agent.delete({ where: { id: agentId } }).catch(() => {
      throw new HttpError(404, "That agent no longer exists.");
    });

    return { ok: true };
  });
}
