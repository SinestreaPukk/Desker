import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { listTriggerRules, updateTriggerRule, whyDidYouMessage, whyDidntYouMessage } from "@/lib/triggers/engine";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

const patchRuleSchema = z.object({
  ruleName: z.string().trim().min(1),
  enabled: z.boolean().optional(),
  time: z.string().trim().optional(),
  quietHoursStart: z.string().trim().optional(),
  quietHoursEnd: z.string().trim().optional(),
  description: z.string().trim().optional(),
  addSuppressedTopic: z.string().trim().optional(),
});

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const url = new URL(request.url);
    const askWhy = url.searchParams.get("why");
    if (askWhy === "fired") {
      const explanation = await whyDidYouMessage(project.id);
      return { explanation };
    }
    if (askWhy === "suppressed") {
      const ruleName = url.searchParams.get("ruleName") || undefined;
      const explanation = await whyDidntYouMessage(project.id, ruleName);
      return { explanation };
    }

    const rules = await listTriggerRules(project.id);
    return { rules };
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, patchRuleSchema);
    try {
      const rule = await updateTriggerRule(project.id, input);
      return { rule };
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not update trigger rule.");
    }
  });
}
