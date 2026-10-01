import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { requireRole } from "@/lib/organizations";
import { audit } from "@/lib/audit";
import { saveBank } from "@/lib/integrations/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ publicToken: z.string().min(1), institution: z.string().trim().min(1).max(80).default("Bank") });

/** Step 2: Link hands back a one-time public token; it is exchanged and sealed here, never kept in the browser. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await findProject(new URL(request.url).searchParams.get("project") ?? "", userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "admin");
    const body = await parseJson(request, input);
    const row = await saveBank(project.organizationId, body.publicToken, body.institution);
    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "integration.connected",
      targetType: "integration",
      targetId: row.id,
      metadata: { type: "bank", name: row.name },
    });
    return { id: row.id, name: row.name };
  });
}
