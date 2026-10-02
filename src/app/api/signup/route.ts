import { prisma } from "@/lib/db";
import { handle, parseJson, HttpError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { passwordProblem } from "@/lib/password-check";
import { signupSchema } from "@/lib/validation";
import { createSpaceFor } from "@/lib/projects";
import { personalSpaceName } from "@/lib/space";
import { audit } from "@/lib/audit";
import { findOpenInvitation } from "@/lib/invites";
import { TERMS_VERSION } from "@/lib/legal";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestLooksAutomated } from "@/lib/bot-check";
import { env } from "@/lib/env";
import { mayUsePlatform, PRIVATE_BETA_MESSAGE } from "@/lib/private-beta";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    // A handful of sign-ups per address in ten minutes is a person or an
    // office; a stream of them is a script.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = await checkRateLimit(`signup:${ip}`, env.signupRateLimit, 10 * 60_000);
    if (!limit.allowed) {
      throw new HttpError(429, `Too many sign-ups from this address. Try again in ${limit.retryAfterSeconds}s.`);
    }
    if (await requestLooksAutomated(request)) {
      throw new HttpError(400, "We couldn't create your account. Please try again.");
    }
    const input = await parseJson(request, signupSchema);
    if (!mayUsePlatform(input.email)) throw new HttpError(403, PRIVATE_BETA_MESSAGE);

    const weak = await passwordProblem(input.password, input.email);
    if (weak) throw new HttpError(422, weak, { fieldErrors: { password: [weak] } });

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "An account with that email already exists.");
    }
    if (await prisma.user.findUnique({ where: { username: input.username } })) {
      throw usernameTaken();
    }
    const profile = {
      name: `${input.firstName} ${input.lastName}`,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
    };

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
          data: {
            email: input.email,
            ...profile,
            passwordHash,
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
          },
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

    // A new account founds its own personal space, with a first project so
    // there is somewhere to put an agent. All or none - a user with no space can reach nothing.
    const passwordHash = await hashPassword(input.password);
    const { user, space } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          ...profile,
          passwordHash,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
        },
        select: { id: true, email: true, name: true },
      });
      const space = await createSpaceFor(user.id, personalSpaceName(input.firstName), tx);
      return { user, space };
    });

    await audit({
      organizationId: space.id,
      actorType: "user",
      actorId: user.id,
      action: "organization.created",
      targetType: "organization",
      targetId: space.id,
      metadata: { name: space.name, via: "signup" },
    });

    return user;
  });
}

function usernameTaken(): HttpError {
  return new HttpError(409, "That username is taken.", { fieldErrors: { username: ["That username is taken - try another."] } });
}
