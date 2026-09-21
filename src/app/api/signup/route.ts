import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { uniqueSlug } from "@/lib/projects";
import { createOrganizationFor, defaultOrganizationName } from "@/lib/organizations";
import { audit } from "@/lib/audit";
import { findOpenInvitation } from "@/lib/invites";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, signupSchema);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "An account with that email already exists.");
    }

    // Signing up from an invitation joins that organisation instead of
    // founding a new one. The address must match: a forwarded link is not
    // an invitation.
    if (input.invite) {
      const invitation = await findOpenInvitation(input.invite);
      if (!invitation) throw new HttpError(404, "This invitation is no longer valid.");
      if (invitation.email !== input.email) {
        throw new HttpError(403, `This invitation was sent to ${invitation.email}. Sign up with that address to accept it.`);
      }
      const passwordHash = await hashPassword(input.password);
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: input.email, name: input.name?.trim() || null, passwordHash },
          select: { id: true, email: true, name: true },
        });
        await tx.membership.create({
          data: { userId: created.id, organizationId: invitation.organizationId, role: invitation.role },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedById: created.id },
        });
        return created;
      });
      await audit({
        organizationId: invitation.organizationId,
        actorType: "user",
        actorId: user.id,
        action: "invitation.accepted",
        targetType: "invitation",
        targetId: invitation.id,
        metadata: { role: invitation.role, via: "signup" },
      });
      return user;
    }

    // A new account is its own tenant: it owns a fresh organisation, and that
    // organisation gets a first project so there is somewhere to put an agent.
    // All three or none - a user with no organisation can reach nothing.
    const passwordHash = await hashPassword(input.password);
    const { user, organization } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name?.trim() || null,
          passwordHash,
        },
        select: { id: true, email: true, name: true },
      });
      const organization = await createOrganizationFor(
        user.id,
        defaultOrganizationName(user),
        tx,
      );
      await tx.project.create({
        data: {
          name: "Default project",
          slug: await uniqueSlug("default", tx),
          organizationId: organization.id,
        },
      });
      return { user, organization };
    });

    await audit({
      organizationId: organization.id,
      actorType: "user",
      actorId: user.id,
      action: "organization.created",
      targetType: "organization",
      targetId: organization.id,
      metadata: { name: organization.name, via: "signup" },
    });

    return user;
  });
}
