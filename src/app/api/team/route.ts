import { z } from "zod";
import { prisma } from "@/lib/platform/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { afterResponse } from "@/lib/platform/after-response";
import { findProject } from "@/lib/tenancy/projects";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { addTeamMessage, teamOf } from "@/lib/agents/team";
import { planChat } from "@/lib/life/router";
import { runChat } from "@/lib/life/chat";
import { EVERYDAY_THREAD, type TeamThreadDto } from "@/lib/agents/team-dto";
import { messageSelect, toMessageDto } from "./serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function projectFrom(handle_: string | null, userId: string) {
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That project no longer exists.");
  return project;
}

/** The chat history: every chat in the project, latest first. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await projectFrom(new URL(request.url).searchParams.get("project"), userId);
    const threads = await prisma.teamThread.findMany({
      where: { projectId: project.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, updatedAt: true },
    });
    return threads.map((thread): TeamThreadDto => ({ ...thread, updatedAt: thread.updatedAt.toISOString() }));
  });
}

const postSchema = z.object({
  project: z.string().min(1),
  /** Omitted to start a new chat. */
  threadId: z.string().min(1).optional(),
  content: z.string().trim().min(1, "Write a message first.").max(4000),
});

/**
 * The owner speaks: the line is stored (in a new chat when there is none),
 * who answers is decided now so the chat can show who is typing, and the
 * replies are written after the response, one agent at a time.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, postSchema);
    const project = await projectFrom(input.project, userId);
    await limitOrganization(project.organizationId, "model");

    // One conversation, shared with the messaging apps.
    const title = EVERYDAY_THREAD;
    const thread = input.threadId
      ? await prisma.teamThread.findFirst({ where: { id: input.threadId, projectId: project.id }, select: { id: true } })
      : ((await prisma.teamThread.findFirst({ where: { projectId: project.id, title }, select: { id: true } })) ??
        (await prisma.teamThread.create({ data: { projectId: project.id, title }, select: { id: true } })));
    if (!thread) throw new HttpError(404, "That chat no longer exists.");

    const [team, user] = await Promise.all([
      teamOf(project.id),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]);
    const { id } = await addTeamMessage({
      projectId: project.id,
      threadId: thread.id,
      userId,
      authorName: user?.name || user?.email.split("@")[0] || "You",
      content: input.content,
    });
    const message = await prisma.teamMessage.findUniqueOrThrow({ where: { id }, select: messageSelect });

    // Respond now; the routing model call and the reply happen after the response.
    const responders = team.slice(0, 1);
    if (team.length > 0) {
      afterResponse(async () => {
        const plan = await planChat({ text: input.content, team, organizationId: project.organizationId });
        const later = await runChat(plan, input.content, team, { projectId: project.id, threadId: thread.id, organizationId: project.organizationId, userId });
        await later?.();
      });
    }

    return {
      threadId: thread.id,
      message: toMessageDto(message),
      responders: responders.map((agent) => ({ id: agent.id, name: agent.name })),
    };
  });
}
