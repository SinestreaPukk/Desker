import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { toStringArray } from "@/lib/agent-fields";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { toolDefinitionsFor } from "@/lib/tools/registry";

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
    await requireAdmin();
    const { agentId } = await params;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new HttpError(404, "That agent no longer exists.");

    const allowedTools = toStringArray(agent.allowedTools);

    const [documents, colleagues] = await Promise.all([
      prisma.document.findMany({
        where: { agentId, status: "ready" },
        select: { filename: true },
      }),
      allowedTools.includes("transfer_to_agent")
        ? prisma.agent.findMany({
            where: { status: "published", projectId: agent.projectId, id: { not: agentId } },
            select: { id: true, name: true, jobTitle: true, department: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

    const prompt = buildSystemPrompt({
      name: agent.name,
      jobTitle: agent.jobTitle,
      department: agent.department,
      personality: agent.personality,
      responsibilities: toStringArray(agent.responsibilities),
      escalationRule: agent.escalationRule,
      allowedTools,
      documentNames: documents.map((document) => document.filename),
      colleagues,
      recall: null,
    });

    return {
      prompt,
      tools: toolDefinitionsFor(allowedTools).map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      // Rough, but enough to spot a persona that has grown into an essay.
      approxTokens: Math.round(prompt.length / 4),
    };
  });
}
