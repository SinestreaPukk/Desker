/**
 * Projects: a workspace inside an organisation, with its own roster, inbox
 * and insights.
 *
 * Everything an admin sees is scoped to exactly one project, and the scope
 * lives in the URL rather than in a cookie - so a link to a conversation is
 * unambiguous, two projects can be open in two tabs, and there is no hidden
 * "current project" to get out of sync with what is on screen.
 *
 * Every lookup here takes the acting user: a project resolves only if the user
 * is a member of the organisation that owns it. A guessed slug from another
 * tenant is a 404, not a page.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { primaryOrganizationFor } from "@/lib/organizations";

export { slugify };

/** Appends a counter until the slug is free. */
export async function uniqueSlug(
  name: string,
  db: Prisma.TransactionClient = prisma,
): Promise<string> {
  const base = slugify(name, "project");
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Projects in organisations the user belongs to - the tenancy filter. */
export function projectsVisibleTo(userId: string): Prisma.ProjectWhereInput {
  return { organization: { memberships: { some: { userId } } } };
}

/**
 * Resolves a project from its URL segment, accepting either the slug or the id
 * so a renamed project's old links still work if someone kept the id.
 * Null when it does not exist or the user cannot see it.
 */
export async function findProject(handle: string, userId: string) {
  return prisma.project.findFirst({
    where: { AND: [projectsVisibleTo(userId), { OR: [{ slug: handle }, { id: handle }] }] },
  });
}

/** Like findProject, but by id only - for routes that carry the id. */
export async function findProjectById(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { AND: [projectsVisibleTo(userId), { id: projectId }] },
  });
}

/** Every project the user can see, oldest first. */
export async function projectsFor(userId: string) {
  return prisma.project.findMany({
    where: projectsVisibleTo(userId),
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The project to land on when none is named. Creating one here means a fresh
 * account never shows an empty chrome with nowhere to go.
 */
export async function defaultProject(userId: string) {
  const [existing] = await projectsFor(userId);
  if (existing) return existing;

  const organization = await primaryOrganizationFor(userId);
  return prisma.project.create({
    data: {
      name: "Default project",
      slug: await uniqueSlug("default"),
      organizationId: organization.id,
    },
  });
}
