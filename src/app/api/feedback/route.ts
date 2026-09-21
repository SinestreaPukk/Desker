import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { notifyInBackground } from "@/lib/notify";
import { track } from "@/lib/product-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["bug", "idea", "question", "other"]).default("other"),
  message: z.string().trim().min(3, "Say a little more.").max(4000),
  path: z.string().trim().max(500).optional(),
  project: z.string().trim().max(200).optional(),
});

/** In-app feedback: stored, forwarded to the notification channel, counted. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const input = await parseJson(request, schema);
    const project = input.project ? await findProject(input.project, userId) : null;
    const organizationId = project?.organizationId ?? null;

    const row = await prisma.feedback.create({
      data: {
        organizationId,
        userId,
        kind: input.kind,
        message: input.message,
        path: input.path ?? null,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    notifyInBackground({
      kind: "feedback",
      title: `Feedback (${input.kind}) from ${email}`,
      body: input.message.slice(0, 1500),
      agentName: "Desker",
      path: input.path,
    });
    await track({ name: "feedback.sent", organizationId, userId, path: input.path, metadata: { kind: input.kind } });
    return { id: row.id };
  });
}
