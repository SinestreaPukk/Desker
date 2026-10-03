import { prisma } from "@/lib/platform/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findAgentFor } from "@/lib/tenancy/projects";
import { createRule, ruleInputSchema, toRuleDto } from "@/lib/work/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/** Every rule this agent follows from the owner's corrections. */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");
    const rules = await prisma.agentRule.findMany({ where: { agentId }, orderBy: { createdAt: "asc" } });
    return rules.map(toRuleDto);
  });
}

/** Save a correction as a rule - from a rejected or edited draft, or typed by hand. */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const agent = await findAgentFor(agentId, userId);
    if (!agent) throw new HttpError(404, "That agent no longer exists.");
    const input = await parseJson(request, ruleInputSchema);
    if (input.actionItemId) {
      const run = await prisma.actionItem.findFirst({ where: { id: input.actionItemId, agentId }, select: { id: true } });
      if (!run) throw new HttpError(404, "That run is not this agent's.");
    }
    return createRule({ id: agentId, organizationId: agent.project.organizationId }, input, userId);
  });
}
