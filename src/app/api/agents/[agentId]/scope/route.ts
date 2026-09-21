import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { findAgentFor } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/organizations";
import { saveScope, toScopeDto, validCron, validTimezone } from "@/lib/work/scope";
import { scopeInputSchema } from "@/lib/work/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");
    const scope = await prisma.scopeOfWork.findUnique({ where: { agentId } });
    return toScopeDto(scope, agentId);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");
    const input = await parseJson(request, scopeInputSchema);

    if (!validTimezone(input.timezone)) {
      throw new HttpError(422, "Some fields need attention.", {
        fieldErrors: { timezone: ["That is not a recognised time zone."] },
      });
    }
    if (input.triggerType === "cron" && (!input.cron || !validCron(input.cron, input.timezone))) {
      throw new HttpError(422, "Some fields need attention.", {
        fieldErrors: { cron: ["Choose a cadence, or enter a valid five-field cron expression."] },
      });
    }
    // Only this agent's own documents can be linked.
    if (input.documentIds.length > 0) {
      const owned = await prisma.document.count({
        where: { agentId, id: { in: input.documentIds } },
      });
      if (owned !== input.documentIds.length) {
        throw new HttpError(422, "Some fields need attention.", {
          fieldErrors: { documentIds: ["One of those documents does not belong to this agent."] },
        });
      }
    }

    // Extending trust past draft-only is an admin decision.
    const existingScope = await prisma.scopeOfWork.findUnique({ where: { agentId } });
    const trustChanged =
      input.autonomy !== (existingScope?.autonomy ?? "draft_only") ||
      JSON.stringify(input.toolAutonomy ?? null) !== JSON.stringify(existingScope?.toolAutonomy ?? null);
    if (trustChanged) await requireRole(userId, agent.project.organizationId, "admin");

    const scope = await saveScope(agentId, input);
    await audit({
      organizationId: agent.project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "scope_of_work.updated",
      targetType: "agent",
      targetId: agentId,
      metadata: {
        triggerType: scope.triggerType,
        cron: scope.cron,
        autonomy: scope.autonomy,
        toolAutonomy: (scope.toolAutonomy as Prisma.InputJsonValue | null) ?? null,
        enabled: scope.enabled,
      },
    });
    return toScopeDto(scope, agentId);
  });
}
