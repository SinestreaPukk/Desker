import { prisma } from "@/lib/platform/db";
import { agentsVisibleTo } from "@/lib/tenancy/projects";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { toStringArray } from "@/lib/agents/agent-fields";
import { buildSystemPrompt } from "@/lib/agents/agent-prompt";
import { toolDefinitionsFor } from "@/lib/tools/registry";
import { buildRunPrompt } from "@/lib/work/prompt";
import { effectiveContext } from "@/lib/work/context";
import { WORK_TOOL_IDS, WORK_TOOL_METADATA, scopeTools } from "@/lib/work/tools";
import { findIntegration, resolveEmail } from "@/lib/work/integrations";
import type { AutonomyMode } from "@/lib/work/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/**
 * The assembled system prompt, exactly as the runtime would build it from the
 * saved configuration. The builder shows it so an admin can see what a
 * persona actually turns into rather than guessing from the form fields.
 */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, ...agentsVisibleTo(userId) },
      include: {
        project: { select: { organizationId: true, context: true } },
        rules: { select: { text: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const allowedTools = toStringArray(agent.allowedTools);

    const [documents, scope, publishing, email] = await Promise.all([
      prisma.document.findMany({
        where: { agentId, status: "ready" },
        select: { filename: true },
      }),
      prisma.scopeOfWork.findUnique({ where: { agentId } }),
      findIntegration(agent.project.organizationId, "webhook"),
      resolveEmail(agent.project.organizationId),
    ]);

    const companyContext = effectiveContext({
      projectContext: agent.project.context,
      agentContext: scope?.context,
    });

    const prompt = buildSystemPrompt({
      name: agent.name,
      jobTitle: agent.jobTitle,
      personality: agent.personality,
      responsibilities: toStringArray(agent.responsibilities),
      allowedTools,
      documentNames: documents.map((document) => document.filename),
      aboutPerson: companyContext,
      rules: agent.rules.map((rule) => rule.text),
    });

    const workPrompt = buildRunPrompt({
      agent,
      scope: {
        // Exactly what a run would read: the project's context, then this
        // agent's. The preview is worthless if it shows less than that.
        context: effectiveContext({
          projectContext: agent.project.context,
          agentContext: scope?.context,
        }),
        objectives: scope ? toStringArray(scope.objectives) : [],
      },
      rules: agent.rules.map((rule) => rule.text),
      autonomy: (scope?.autonomy as AutonomyMode) ?? "draft_only",
      documentNames: documents.map((document) => document.filename),
      hasPublishing: Boolean(publishing),
      hasEmail: Boolean(email),
    });

    const activeWorkTools = scopeTools(scope?.tools) ?? [...WORK_TOOL_IDS];

    return {
      prompt,
      tools: toolDefinitionsFor(allowedTools).map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      approxTokens: Math.round(prompt.length / 4),
      workPrompt,
      workTools: activeWorkTools.map((t) => ({
        name: t,
        description: WORK_TOOL_METADATA[t]?.label ?? t,
      })),
      approxWorkTokens: Math.round(workPrompt.length / 4),
    };
  });
}
