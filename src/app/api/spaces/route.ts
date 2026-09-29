import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { createSpaceFor } from "@/lib/projects";
import { audit } from "@/lib/audit";
import { SPACE_KINDS, personalSpaceName } from "@/lib/space";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const spaceSchema = z
  .object({
    kind: z.enum(SPACE_KINDS),
    /** A business's name. A personal space is named after its person. */
    name: z.string().trim().max(80, "That name is too long.").optional(),
  })
  .refine((input) => input.kind === "personal" || Boolean(input.name), {
    path: ["name"],
    message: "Enter your business's name.",
  });

/**
 * Adds a space to the signed-in account: a business alongside a personal
 * space, or the other way round - "both", chosen after sign-up. One personal
 * space per person; as many businesses as they run.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, spaceSchema);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, name: true } });
    if (input.kind === "personal") {
      const existing = await prisma.organization.findFirst({
        where: { kind: "personal", memberships: { some: { userId, role: "owner" } } },
        select: { id: true },
      });
      if (existing) throw new HttpError(409, "You already have a personal space.");
    }
    const space = await prisma.$transaction((tx) =>
      createSpaceFor(userId, input.kind, input.kind === "personal" ? personalSpaceName(user.firstName ?? user.name?.split(" ")[0]) : input.name!, tx),
    );
    await audit({
      organizationId: space.id,
      actorType: "user",
      actorId: userId,
      action: "organization.created",
      targetType: "organization",
      targetId: space.id,
      metadata: { name: space.name, kind: space.kind, via: "switcher" },
    });
    return { id: space.id, name: space.name, kind: space.kind, project: { slug: space.project.slug } };
  });
}
