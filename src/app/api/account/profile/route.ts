import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { prisma } from "@/lib/platform/db";
import { findProject } from "@/lib/tenancy/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  project: z.string().max(80),
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, "Use 3-30 letters, numbers, dots, dashes or underscores, starting with a letter or number."),
  /** What the assistant calls them. Empty clears it. */
  nickname: z.string().trim().max(40),
});

/** Name, username and nickname. The nickname is kept as a preference every assistant already reads. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const input = await parseJson(request, schema);
    const taken = await prisma.user.findFirst({ where: { username: input.username, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw new HttpError(409, "That username is taken.", { fieldErrors: { username: ["That username is taken - try another."] } });
    await prisma.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}`, username: input.username },
    });
    const project = await findProject(input.project, userId);
    if (project) {
      const where = { projectId_key: { projectId: project.id, key: "nickname" } };
      if (input.nickname) {
        await prisma.lifePreference.upsert({
          where,
          create: { projectId: project.id, key: "nickname", value: `Call them "${input.nickname}"` },
          update: { value: `Call them "${input.nickname}"` },
        });
      } else {
        await prisma.lifePreference.deleteMany({ where: { projectId: project.id, key: "nickname" } });
      }
    }
    return { ok: true };
  });
}
