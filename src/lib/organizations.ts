/**
 * Organisations: the access and billing boundary.
 *
 * A user reaches anything only through a Membership. Every signed-in user has
 * at least one organisation - sign-up creates it, and `primaryOrganizationFor`
 * repairs the invariant for any account that somehow lacks one, by creating a
 * fresh personal organisation rather than by dropping the user into someone
 * else's.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";

export type OrganizationRole = "owner" | "admin" | "member";

/** Appends a counter until the slug is free. */
export async function uniqueOrganizationSlug(
  name: string,
  db: Prisma.TransactionClient = prisma,
): Promise<string> {
  const base = slugify(name, "org");
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** The name a brand-new account's organisation gets before anyone renames it. */
export function defaultOrganizationName(user: { name?: string | null; email: string }) {
  const first = user.name?.trim().split(/\s+/)[0];
  if (first) return `${first}'s organization`;
  const local = user.email.split("@")[0] ?? "";
  return local ? `${local}'s organization` : "My organization";
}

/**
 * Creates an organisation with `userId` as its owner. Runs inside the caller's
 * transaction when one is supplied so sign-up is all-or-nothing.
 */
export async function createOrganizationFor(
  userId: string,
  name: string,
  db: Prisma.TransactionClient = prisma,
) {
  return db.organization.create({
    data: {
      name,
      slug: await uniqueOrganizationSlug(name, db),
      memberships: { create: { userId, role: "owner" } },
    },
  });
}

/** Every organisation the user belongs to, oldest membership first. */
export async function organizationsFor(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  return memberships.map((membership) => ({
    ...membership.organization,
    role: membership.role as OrganizationRole,
  }));
}

/**
 * The organisation to act in when none is named: the user's oldest
 * membership. Creates a personal organisation if the user has none at all,
 * so the "every user belongs to an organisation" invariant holds even for an
 * account that predates tenancy and was missed by the backfill.
 */
export async function primaryOrganizationFor(userId: string) {
  const [first] = await organizationsFor(userId);
  if (first) return first;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const organization = await createOrganizationFor(
    userId,
    defaultOrganizationName(user),
  );
  return { id: organization.id, name: organization.name, slug: organization.slug, role: "owner" as const };
}

/** Membership check. Null when the user is not in the organisation. */
export async function membershipOf(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  return membership ? (membership.role as OrganizationRole) : null;
}

/** owner > admin > member. */
const RANK: Record<OrganizationRole, number> = { owner: 3, admin: 2, member: 1 };

export function roleAtLeast(role: OrganizationRole | null, required: OrganizationRole): boolean {
  return role !== null && RANK[role] >= RANK[required];
}

export class Forbidden extends Error {
  constructor(message = "You do not have permission to do that in this organisation.") {
    super(message);
    this.name = "Forbidden";
  }
}

/**
 * The gate for organisation-level actions. Members use agents; admins also
 * manage them, integrations and trust; owners also manage people and billing.
 */
export async function requireRole(
  userId: string,
  organizationId: string,
  required: OrganizationRole,
): Promise<OrganizationRole> {
  const role = await membershipOf(userId, organizationId);
  if (!roleAtLeast(role, required)) throw new Forbidden();
  return role!;
}
