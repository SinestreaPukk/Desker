import { prisma } from "@/lib/platform/db";
import { handle, parseJson, HttpError } from "@/lib/platform/api";
import { hashPassword } from "@/lib/auth/auth";
import { passwordProblem } from "@/lib/auth/password-check";
import { signupSchema } from "@/lib/shared/validation";
import { createSpaceFor } from "@/lib/tenancy/projects";
import { personalSpaceName } from "@/lib/tenancy/space";
import { audit } from "@/lib/platform/audit";
import { TERMS_VERSION } from "@/lib/site/legal";
import { checkRateLimit } from "@/lib/platform/rate-limit";
import { requestLooksAutomated } from "@/lib/auth/bot-check";
import { env } from "@/lib/platform/env";
import { mayUsePlatform, PRIVATE_BETA_MESSAGE } from "@/lib/site/private-beta";

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
