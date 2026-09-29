import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { findAgentFor } from "@/lib/projects";
import { ruleInputSchema, toRuleDto } from "@/lib/work/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string; ruleId: string }> };

async function load(agentId: string, ruleId: string, userId: string) {
  const agent = await findAgentFor(agentId, userId);
  if (!agent) throw new HttpError(404, "That agent no longer exists.");
  const rule = await prisma.agentRule.findFirst({ where: { id: ruleId, agentId } });
  if (!rule) throw new HttpError(404, "That rule no longer exists.");
  return { agent, rule };
}

/** Reword a rule. The old and new wording both go in the audit trail. */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId, ruleId } = await params;
    const { agent, rule } = await load(agentId, ruleId, userId);
    const { text } = await parseJson(request, ruleInputSchema.pick({ text: true }));
    const updated = await prisma.agentRule.update({ where: { id: rule.id }, data: { text } });
    await audit({
      organizationId: agent.project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "agent_rule.updated",
      targetType: "agent",
      targetId: agentId,
      metadata: { ruleId, before: rule.text, text },
    });
    return toRuleDto(updated);
  });
}

/** Stop following a rule. */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId, ruleId } = await params;
    const { agent, rule } = await load(agentId, ruleId, userId);
    await prisma.agentRule.delete({ where: { id: rule.id } });
    await audit({
      organizationId: agent.project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "agent_rule.removed",
      targetType: "agent",
      targetId: agentId,
      metadata: { ruleId, text: rule.text },
    });
    return { removed: true };
  });
}
