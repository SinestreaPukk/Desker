import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { requireRole } from "@/lib/organizations";
import { findProject } from "@/lib/projects";
import { projectCheckInSettingsSchema } from "@/lib/work/validation";
import { validTimezone } from "@/lib/work/scope";
import { checkInSettings } from "@/lib/work/check-in-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const project = await findProject(projectId, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    return checkInSettings(project.id);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId } = await params;
    const project = await findProject(projectId, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "admin");
    const input = await parseJson(request, projectCheckInSettingsSchema);
    if (!validTimezone(input.timezone)) {
      throw new HttpError(422, "Choose a recognised time zone.", { fieldErrors: { timezone: ["That time zone is not recognised."] } });
    }
    await prisma.project.update({
      where: { id: project.id },
      data: {
        checkInCadence: input.cadence,
        checkInTimezone: input.timezone,
        checkInEmail: input.email,
        checkInRecipients: input.recipients.trim(),
      },
    });
    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "project.checkin_settings.updated",
      targetType: "project",
      targetId: project.id,
      metadata: { cadence: input.cadence, email: input.email, timezone: input.timezone },
    });
    return checkInSettings(project.id);
  });
}
