import { prisma } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { projectsVisibleTo } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  agentCount: number;
  publishedCount: number;
  createdAt: string;
}

export async function GET() {
  return handle(async () => {
    const { userId } = await requireAdmin();

    const projects = await prisma.project.findMany({
      where: projectsVisibleTo(userId),
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        agents: { select: { status: true } },
      },
    });

    return projects.map(
      (project): ProjectDto => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        agentCount: project.agents.length,
        publishedCount: project.agents.filter((agent) => agent.status === "published")
          .length,
        createdAt: project.createdAt.toISOString(),
      }),
    );
  });
}
