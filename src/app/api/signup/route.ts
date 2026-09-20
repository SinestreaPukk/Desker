import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { uniqueSlug } from "@/lib/projects";
import { createOrganizationFor, defaultOrganizationName } from "@/lib/organizations";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, signupSchema);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "An account with that email already exists.");
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
