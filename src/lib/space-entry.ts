/**
 * Where someone lands when they go into a space: its first run while it is
 * brand new (nothing described, nobody hired), its Roster after that.
 * Shared by the front door and the "Where to?" chooser.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { projectsVisibleTo } from "@/lib/projects";
import { hasCoreContext } from "@/lib/work/context";
import { spaceKind, type SpaceKind } from "@/lib/space";

interface EntryProject {
  id: string;
  slug: string;
  context: string | null;
  contextAnswers: unknown;
  organization: { kind: string };
}

export async function entryPath(project: EntryProject): Promise<string> {
  const fresh =
    !hasCoreContext(project, spaceKind(project.organization.kind)) &&
    (await prisma.agent.count({ where: { projectId: project.id } })) === 0;
  return fresh ? `/p/${project.slug}/start` : `/p/${project.slug}/roster`;
}

export interface SpaceChoice {
  kind: SpaceKind;
  /** The space (organisation) name, and the project inside it when it has more than one. */
  name: string;
  project: string | null;
  href: string;
}

/** Every space this person can go into, business first, each with its front door. */
export async function spaceChoices(userId: string): Promise<SpaceChoice[]> {
  const projects = await prisma.project.findMany({
    where: projectsVisibleTo(userId),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      context: true,
      contextAnswers: true,
      organizationId: true,
      organization: { select: { kind: true, name: true } },
    },
  });
  const perOrganization = new Map<string, number>();
  for (const project of projects) perOrganization.set(project.organizationId, (perOrganization.get(project.organizationId) ?? 0) + 1);
  const choices = await Promise.all(
    projects.map(async (project) => ({
      kind: spaceKind(project.organization.kind),
      name: project.organization.name,
      project: (perOrganization.get(project.organizationId) ?? 0) > 1 ? project.name : null,
      href: await entryPath(project),
    })),
  );
  return choices.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "business" ? -1 : 1));
}
