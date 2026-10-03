import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findAgentFor } from "@/lib/tenancy/projects";
import { listRoutines, routinesInputSchema, saveRoutines } from "@/lib/work/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

async function ownedAgent(params: Params["params"]) {
  const { userId } = await requireAdmin();
  const { agentId } = await params;
  if (!(await findAgentFor(agentId, userId))) throw new HttpError(404, "That agent no longer exists.");
  return agentId;
}

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => listRoutines(await ownedAgent(params)));
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const agentId = await ownedAgent(params);
    const input = await parseJson(request, routinesInputSchema);
    return saveRoutines(agentId, input.routines);
  });
}
