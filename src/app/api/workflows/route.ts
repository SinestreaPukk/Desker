import { z } from "zod";
import { prisma } from "@/lib/platform/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { startWorkflow, workflowRuns } from "@/lib/work/workflow-run";
import { suggestAgent, WORKFLOWS } from "@/lib/work/workflows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function projectFrom(request: Request, userId: string) {
  const handle_ = new URL(request.url).searchParams.get("project");
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That project no longer exists.");
  return project;
}

/** The workflows this space can start (with an agent suggested per step), and the recent ones with their progress. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await projectFrom(request, userId);
    const agents = await prisma.agent.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, jobTitle: true, status: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });
    return {
      workflows: WORKFLOWS.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        pitch: workflow.pitch,
        input: workflow.input,
        gate: workflow.gate,
        steps: workflow.steps.map((step) => ({
          title: step.title,
          roleLabel: step.roleLabel,
          suggestedAgentId: suggestAgent(step, agents)?.id ?? null,
        })),
      })),
      agents: agents.filter((agent) => agent.status === "published"),
      runs: await workflowRuns(project.id),
    };
  });
}

const startSchema = z.object({
  workflowId: z.string().min(1).max(80),
  input: z.string().trim().max(4000).default(""),
  agentIds: z.array(z.string().min(1).max(64)).min(1).max(5),
});

/** Start a named workflow on purpose. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await projectFrom(request, userId);
    const body = await parseJson(request, startSchema);
    const run = await startWorkflow({
      workflowId: body.workflowId,
      projectId: project.id,
      organizationId: project.organizationId,
      text: body.input,
      agentIds: body.agentIds,
      userId,
    });
    if (!run) throw new HttpError(409, "That workflow was already started.");
    return run;
  });
}
