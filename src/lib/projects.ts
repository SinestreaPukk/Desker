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
import { createOrganizationFor, primaryOrganizationFor } from "@/lib/organizations";

;

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

/**
 * The project to land on when none is named. Creating one here means a fresh
 * account never shows an empty chrome with nowhere to go.
 */
export async function defaultProject(userId: string) {
  const existing = await prisma.project.findFirst({
    where: projectsVisibleTo(userId),
    orderBy: { createdAt: "asc" },
  });
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

/**
 * A new personal space owned by `userId`, with a
 * first project to put agents in. Runs inside the caller's transaction so
 * sign-up is all-or-nothing.
 */
export async function createSpaceFor(
  userId: string,
  name: string,
  db: Prisma.TransactionClient = prisma,
) {
  const organization = await createOrganizationFor(userId, name, db);
  const project = await db.project.create({
    data: {
      name: "Personal",
      slug: await uniqueSlug("personal", db),
      organizationId: organization.id,
    },
  });
  return { ...organization, project };
}

/** Agents in projects the user can see - the tenancy filter for agent routes. */
export function agentsVisibleTo(userId: string): Prisma.AgentWhereInput {
  return { project: projectsVisibleTo(userId) };
}

/**
 * An agent the user may act on, with the organisation it bills to. Null when
 * it does not exist or belongs to a tenant the user is not part of.
 */
export async function findAgentFor(agentId: string, userId: string) {
  return prisma.agent.findFirst({
    where: { AND: [agentsVisibleTo(userId), { id: agentId }] },
    include: {
      project: { select: { id: true, slug: true, organizationId: true } },
    },
  });
}
