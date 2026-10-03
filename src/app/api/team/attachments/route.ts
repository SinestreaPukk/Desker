import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { addTeamMessage, teamOf } from "@/lib/agents/team";
import { EVERYDAY_THREAD } from "@/lib/agents/team-dto";
import { ATTACHMENT_HELP, MAX_ATTACHMENT_BYTES, attachmentSupported, receiveAttachment } from "@/lib/life/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reading a photo or a PDF takes a few seconds.
export const maxDuration = 60;

const MAX_FILES = 5;

/**
 * The person sends photos or files in the chat. Each is shown as their line,
 * handled by the same pipeline as LINE, and answered by the assistant in the
 * same chat. What to do next comes back as one-tap replies.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const form = await request.formData().catch(() => {
      throw new HttpError(400, "Expected a file upload.");
    });
    const project = await findProject(String(form.get("project") ?? ""), userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    const files = form.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) throw new HttpError(400, "No file was included.");
    if (files.length > MAX_FILES) throw new HttpError(400, `Send up to ${MAX_FILES} files at a time.`);
    await limitOrganization(project.organizationId, "model");

    const [agent] = await teamOf(project.id);
    if (!agent) throw new HttpError(409, "Switch your assistant on first.");

    const threadId = String(form.get("threadId") ?? "");
    const newChat = form.get("newChat") === "true";
    const thread = newChat
      ? await prisma.teamThread.create({ data: { projectId: project.id, title: files[0]!.name.slice(0, 60) }, select: { id: true } })
      : threadId
        ? await prisma.teamThread.findFirst({ where: { id: threadId, projectId: project.id }, select: { id: true } })
        : ((await prisma.teamThread.findFirst({ where: { projectId: project.id, title: EVERYDAY_THREAD }, select: { id: true } })) ??
          (await prisma.teamThread.create({ data: { projectId: project.id, title: EVERYDAY_THREAD }, select: { id: true } })));
    if (!thread) throw new HttpError(404, "That chat no longer exists.");

    const space = { organizationId: project.organizationId, projectId: project.id };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const author = user?.name || user?.email.split("@")[0] || "You";
    let nextSteps: string[] = [];
    for (const file of files) {
      await addTeamMessage({ projectId: project.id, threadId: thread.id, userId, authorName: author, content: `Sent ${file.name}` });
      let reply: { text: string; nextSteps?: string[] };
      try {
        reply =
          !attachmentSupported(file.name) ? { text: ATTACHMENT_HELP }
          : file.size > MAX_ATTACHMENT_BYTES ? { text: `${file.name} is too big. The limit is 10 MB.` }
          : await receiveAttachment(space, agent.id, { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) });
      } catch (error) {
        console.error("[attachments] failed", error);
        reply = { text: `I couldn't read ${file.name}. Try again in a moment.` };
      }
      await addTeamMessage({ projectId: project.id, threadId: thread.id, agentId: agent.id, content: reply.text });
      nextSteps = reply.nextSteps ?? [];
    }
    return { threadId: thread.id, nextSteps };
  });
}
