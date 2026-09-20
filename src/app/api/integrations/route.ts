import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { primaryOrganizationFor, membershipOf } from "@/lib/organizations";
import { audit } from "@/lib/audit";
import { integrationInputSchema } from "@/lib/work/validation";
import { toIntegrationDto } from "./serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Integrations belong to the organisation; `project` just names which one. */
async function organizationFor(userId: string, projectHandle: string | null) {
  if (projectHandle) {
    const project = await findProject(projectHandle, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    return project.organizationId;
  }
  return (await primaryOrganizationFor(userId)).id;
}

export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const organizationId = await organizationFor(userId, new URL(request.url).searchParams.get("project"));
    const rows = await prisma.integration.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toIntegrationDto);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const organizationId = await organizationFor(userId, new URL(request.url).searchParams.get("project"));
    if (!(await membershipOf(userId, organizationId))) {
      throw new HttpError(403, "You are not a member of that organisation.");
    }
    const input = await parseJson(request, integrationInputSchema);

    const config =
      input.type === "webhook"
        ? { url: input.url, ...(input.secret ? { secret: input.secret } : {}) }
        : { provider: "resend", from: input.from, apiKey: input.apiKey };

    const row = await prisma.integration.create({
      data: { organizationId, type: input.type, name: input.name, config },
    });
    await audit({
      organizationId,
      actorType: "user",
      actorId: userId,
      action: "integration.connected",
      targetType: "integration",
      targetId: row.id,
      // Name and type only. Never the config.
      metadata: { type: row.type, name: row.name },
    });
    return toIntegrationDto(row);
  });
}
