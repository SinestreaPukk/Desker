import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject, projectsVisibleTo } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_PREFIX = "preview:";

export interface AgentStats {
  id: string;
  name: string;
  jobTitle: string;
  avatarUrl: string | null;
  status: string;
  conversations: number;
  escalations: number;
  /** Share of this agent's conversations that ended up needing a person. */
  escalationRate: number | null;
  issues: number;
  suggestions: number;
  searches: number;
  /** Share of searches that returned at least one passage. */
  retrievalHitRate: number | null;
  documents: number;
  /** Client ratings on this agent's replies. */
  ratedUp: number;
  ratedDown: number;
  /** Share of rated replies the client found helpful. */
  satisfaction: number | null;
}

export interface DislikedReply {
  messageId: string;
  conversationId: string;
  agentName: string;
  /** The client's question immediately before the disliked reply, if any. */
  question: string | null;
  reply: string;
  ratedAt: string;
}

export interface ContentGap {
  query: string;
  misses: number;
  agentName: string;
  lastAskedAt: string;
}

/**
 * Roster analytics.
 *
 * The escalation and retrieval rates say which agents are struggling; the
 * content gaps say why. A question that repeatedly returns nothing is a
 * document nobody has written yet, which is the most actionable thing this
 * dashboard can tell an admin.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const projectHandle = new URL(request.url).searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) {
      throw new HttpError(404, "That project no longer exists.");
    }
    const inProject = project
      ? { projectId: project.id }
      : { project: projectsVisibleTo(userId) };

    const days = Math.min(
      Math.max(Number.parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10) || 30, 1),
      365,
    );
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const realClients = { NOT: { clientSessionId: { startsWith: PREVIEW_PREFIX } } };

    const [agents, conversations, issues, retrieval, rated] = await Promise.all([
      prisma.agent.findMany({
        where: inProject,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          jobTitle: true,
          avatarUrl: true,
          status: true,
          _count: { select: { documents: true } },
        },
      }),
      prisma.conversation.findMany({
        where: {
          createdAt: { gte: since },
          ...realClients,
          agent: inProject,
        },
        select: { id: true, agentId: true, activeAgentId: true, status: true },
      }),
      prisma.issue.findMany({
        where: {
          createdAt: { gte: since },
          conversation: {
            ...realClients,
            agent: inProject,
          },
        },
        select: { type: true, conversationId: true },
      }),
      prisma.retrievalLog.findMany({
        where: { createdAt: { gte: since }, agent: inProject },
        select: { agentId: true, query: true, hitCount: true, createdAt: true },
      }),
      prisma.message.findMany({
        where: {
          rating: { not: null },
          ratedAt: { gte: since },
          conversation: { ...realClients, agent: inProject },
        },
        orderBy: { ratedAt: "desc" },
        select: {
          id: true,
          content: true,
          rating: true,
          ratedAt: true,
          createdAt: true,
          conversationId: true,
        },
      }),
    ]);

    const byAgent = new Map<string, AgentStats>();
    for (const agent of agents) {
      byAgent.set(agent.id, {
        id: agent.id,
        name: agent.name,
        jobTitle: agent.jobTitle,
        avatarUrl: agent.avatarUrl,
        status: agent.status,
        conversations: 0,
        escalations: 0,
        escalationRate: null,
        issues: 0,
        suggestions: 0,
        searches: 0,
        retrievalHitRate: null,
        documents: agent._count.documents,
        ratedUp: 0,
        ratedDown: 0,
        satisfaction: null,
      });
    }

    // A transferred conversation counts against whoever is handling it now -
    // that is who the outcome belongs to.
    const ownerOf = new Map<string, string>();
    for (const conversation of conversations) {
      const owner = conversation.activeAgentId ?? conversation.agentId;
      ownerOf.set(conversation.id, owner);
      const stats = byAgent.get(owner);
      if (!stats) continue;
      stats.conversations += 1;
      if (conversation.status === "escalated") stats.escalations += 1;
    }

    for (const issue of issues) {
      const stats = byAgent.get(ownerOf.get(issue.conversationId) ?? "");
      if (!stats) continue;
      if (issue.type === "suggestion") stats.suggestions += 1;
      else if (issue.type === "issue") stats.issues += 1;
      else if (issue.type === "escalation") {
        // Escalations are already counted from conversation status; counting
        // the issue row too would double them.
      }
    }

    const hits = new Map<string, { total: number; found: number }>();
    for (const log of retrieval) {
      const entry = hits.get(log.agentId) ?? { total: 0, found: 0 };
      entry.total += 1;
      if (log.hitCount > 0) entry.found += 1;
      hits.set(log.agentId, entry);
    }
    for (const [agentId, entry] of hits) {
      const stats = byAgent.get(agentId);
      if (!stats) continue;
      stats.searches = entry.total;
      stats.retrievalHitRate = entry.total > 0 ? entry.found / entry.total : null;
    }

    for (const message of rated) {
      const stats = byAgent.get(ownerOf.get(message.conversationId) ?? "");
      if (!stats) continue;
      if (message.rating === 1) stats.ratedUp += 1;
      else if (message.rating === -1) stats.ratedDown += 1;
    }

    for (const stats of byAgent.values()) {
      stats.escalationRate =
        stats.conversations > 0 ? stats.escalations / stats.conversations : null;
      const total = stats.ratedUp + stats.ratedDown;
      stats.satisfaction = total > 0 ? stats.ratedUp / total : null;
    }

    // The replies clients disliked, with the question that prompted each - the
    // most direct list of what to improve after the content gaps.
    const disliked = rated.filter((message) => message.rating === -1).slice(0, 25);
    const questions = new Map<string, string | null>();
    for (const message of disliked) {
      const prior = await prisma.message.findFirst({
        where: {
          conversationId: message.conversationId,
          role: "user",
          createdAt: { lt: message.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      });
      questions.set(message.id, prior?.content ?? null);
    }
    const dislikedReplies: DislikedReply[] = disliked.map((message) => ({
      messageId: message.id,
      conversationId: message.conversationId,
      agentName:
        byAgent.get(ownerOf.get(message.conversationId) ?? "")?.name ?? "Unknown",
      question: questions.get(message.id) ?? null,
      reply: message.content,
      ratedAt: (message.ratedAt ?? message.createdAt).toISOString(),
    }));

    // Content gaps: questions the documents could not answer, grouped by the
    // normalised query so near-duplicates stack up instead of scattering.
    const gaps = new Map<string, ContentGap>();
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
    for (const log of retrieval) {
      if (log.hitCount > 0) continue;
      const key = `${log.agentId}:${log.query.toLowerCase().replace(/\s+/g, " ").trim()}`;
      const existing = gaps.get(key);
      if (existing) {
        existing.misses += 1;
        if (log.createdAt.toISOString() > existing.lastAskedAt) {
          existing.lastAskedAt = log.createdAt.toISOString();
        }
      } else {
        gaps.set(key, {
          query: log.query,
          misses: 1,
          agentName: agentNames.get(log.agentId) ?? "Unknown",
          lastAskedAt: log.createdAt.toISOString(),
        });
      }
    }

    const totals = {
      conversations: conversations.length,
      escalated: conversations.filter((c) => c.status === "escalated").length,
      issues: issues.filter((i) => i.type === "issue").length,
      suggestions: issues.filter((i) => i.type === "suggestion").length,
      searches: retrieval.length,
      searchMisses: retrieval.filter((log) => log.hitCount === 0).length,
      ratedUp: rated.filter((message) => message.rating === 1).length,
      ratedDown: rated.filter((message) => message.rating === -1).length,
    };

    return {
      days,
      totals,
      agents: [...byAgent.values()].filter(
        (stats) => stats.conversations > 0 || stats.status === "published",
      ),
      contentGaps: [...gaps.values()]
        .sort((a, b) => b.misses - a.misses || b.lastAskedAt.localeCompare(a.lastAskedAt))
        .slice(0, 25),
      dislikedReplies,
    };
  });
}
