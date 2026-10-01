import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { requireRole } from "@/lib/organizations";
import { createLinkToken, plaidConfigured } from "@/lib/integrations/plaid";
import { vaultConfigured } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1 of linking a bank: a short-lived token that opens Plaid's own sign-in window. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await findProject(new URL(request.url).searchParams.get("project") ?? "", userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");
    await requireRole(userId, project.organizationId, "admin");
    if (!plaidConfigured()) throw new HttpError(503, "Bank connections are not set up on this server yet.");
    if (!vaultConfigured()) throw new HttpError(503, "Connections cannot be stored until the server has a VAULT_KEY.");
    return { linkToken: await createLinkToken(userId) };
  });
}
