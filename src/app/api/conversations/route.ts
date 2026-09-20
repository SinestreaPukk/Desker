import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject, projectsVisibleTo } from "@/lib/projects";
import { usesPgVector } from "@/lib/env";

const insensitive = usesPgVector ? { mode: "insensitive" as const } : {};
import type { ConversationSummaryDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_PREFIX = "preview:";

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) {
      throw new HttpError(404, "That project no longer exists.");
    }

    const agentId = url.searchParams.get("agentId");
    const status = url.searchParams.get("status");
    const withIssues = url.searchParams.get("withIssues") === "true";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const includePreviews = url.searchParams.get("includePreviews") === "true";
    const take = Math.min(
      Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
      200,
    );

    const where: Prisma.ConversationWhereInput = {
      agent: project ? { projectId: project.id } : { project: projectsVisibleTo(userId) },
      ...(agentId ? { agentId } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(withIssues ? { issues: { some: {} } } : {}),
      // Free-text search over what was said and what it was about. Prisma's
      // `contains` is case-insensitive on SQLite already; Postgres needs to be
      // told, and rejects the flag on SQLite, so it is applied per provider.
      ...(q
        ? {
            OR: [
              { summary: { contains: q, ...insensitive } },
              { messages: { some: { content: { contains: q, ...insensitive } } } },
            ],
          }
        : {}),
      // Builder preview chats are real conversations but are not client traffic.
      ...(includePreviews
        ? {}
        : { NOT: { clientSessionId: { startsWith: PREVIEW_PREFIX } } }),
    };

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take,
      select: {
        id: true,
        status: true,
        replyMode: true,
        takenOverBy: true,
        summary: true,
        createdAt: true,
        lastMessageAt: true,
        agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
        activeAgent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
        _count: { select: { messages: true, issues: true } },
        issues: { where: { status: "open" }, select: { id: true } },
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    return conversations.map(
      (conversation): ConversationSummaryDto => ({
        id: conversation.id,
        // Whoever is handling it now, which is the colleague after a transfer.
        agent: conversation.activeAgent ?? conversation.agent,
        status: conversation.status,
        mode: conversation.replyMode,
        takenOverBy: conversation.takenOverBy,
        summary: conversation.summary,
        messageCount: conversation._count.messages,
        issueCount: conversation._count.issues,
        openIssueCount: conversation.issues.length,
        preview: conversation.messages[0]?.content.slice(0, 160) ?? "",
        createdAt: conversation.createdAt.toISOString(),
        lastMessageAt: conversation.lastMessageAt.toISOString(),
      }),
    );
  });
}
