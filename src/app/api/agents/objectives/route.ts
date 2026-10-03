import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { env } from "@/lib/platform/env";
import { findProject } from "@/lib/tenancy/projects";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { getProvider } from "@/lib/llm/provider";
import { parseModelJson } from "@/lib/work/model-json";

export const runtime = "nodejs";

const inputSchema = z.object({
  jobTitle: z.string().trim().min(1).max(120),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(25).default([]),
});

const PROMPT = `You write the standing goals for an AI worker that runs on its own, on a schedule.
Given its job and duties, write 3 or 4 goals. Each goal is one plain sentence, under 20 words, starting with a verb, concrete enough to check a week's work against ("Draft two LinkedIn posts a week from the research", not "Improve marketing"). Nothing that would send, pay or sign without approval.
Reply with JSON only: {"objectives": ["...", "..."]}`;

/** "Write them for me": goals drafted from the job and the duties ticked. Nothing is saved. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await findProject(new URL(request.url).searchParams.get("project") ?? "", userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    if (!env.hasAnthropicKey && !env.hasOpenAiKey) throw new HttpError(503, "No AI model is set up on this server yet.");
    await limitOrganization(project.organizationId, "model");
    const input = await parseJson(request, inputSchema);

    const provider = await getProvider(env.hasAnthropicKey ? "anthropic" : "openai");
    const turn = await provider.complete({
      billing: { organizationId: project.organizationId },
      systemPrompt: PROMPT,
      messages: [
        {
          role: "user",
          content: `It helps one person with their own life.\nJob: ${input.jobTitle}\nDuties:\n${input.responsibilities.map((line) => `- ${line}`).join("\n") || "- (none given)"}`,
        },
      ],
      tools: [],
      model: null,
      maxTokens: 400,
    });
    const raw = parseModelJson(turn.message.content)?.objectives;
    const objectives = (Array.isArray(raw) ? raw : [])
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((item) => item.slice(0, 200));
    if (objectives.length === 0) throw new HttpError(502, "The goals couldn't be written just now. Try again.");
    return { objectives };
  });
}
