import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { uniqueSlug, projectsVisibleTo } from "@/lib/projects";
import { primaryOrganizationFor } from "@/lib/organizations";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(80),
});

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

export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, projectSchema);

    // New projects go in the caller's primary organisation until the org
    // switcher exists to choose one explicitly.
    const organization = await primaryOrganizationFor(userId);
    const project = await prisma.project.create({
      data: {
        name: input.name,
        slug: await uniqueSlug(input.name),
        organizationId: organization.id,
      },
    });

    await audit({
      organizationId: organization.id,
      actorType: "user",
      actorId: userId,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name, slug: project.slug },
    });

    const dto: ProjectDto = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      agentCount: 0,
      publishedCount: 0,
      createdAt: project.createdAt.toISOString(),
    };
    return dto;
  });
}
