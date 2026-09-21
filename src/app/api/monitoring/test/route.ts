import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { requireRole } from "@/lib/organizations";
import { captureError, captureMessage, monitoringEnabled } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends one deliberate error and one warning to error monitoring, tagged
 * with the caller's organisation, so an owner can prove the alert path
 * works before trusting it. Owners only; does nothing without a DSN.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const projectHandle = new URL(request.url).searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "owner");
    if (!monitoringEnabled()) throw new HttpError(503, "Error monitoring is not configured (no SENTRY_DSN).");

    const at = new Date().toISOString();
    captureError(new Error(`Monitoring test error from ${project.slug} at ${at}`), {
      organizationId: project.organizationId,
      route: "api:monitoring/test",
      test: true,
    });
    captureMessage(`Monitoring test warning from ${project.slug} at ${at}`, {
      organizationId: project.organizationId,
      route: "api:monitoring/test",
      test: true,
    });
    return { sent: true, at };
  });
}
