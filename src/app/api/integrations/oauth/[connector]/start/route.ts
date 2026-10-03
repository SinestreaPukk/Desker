import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/auth";
import { findProject } from "@/lib/tenancy/projects";
import { membershipOf, roleAtLeast } from "@/lib/tenancy/organizations";
import { vaultConfigured } from "@/lib/auth/vault";
import { connectorById } from "@/lib/integrations/catalog";
import { authorizeUrl, oauthConfigured, pkcePair, signState, usesPkce } from "@/lib/integrations/oauth";
import { NONCE_COOKIE, PKCE_COOKIE, backTo, callbackUrl } from "@/lib/integrations/oauth-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Connect": sends the owner to the provider's own approval page. A plain
 * navigation, not a fetch, so every failure lands back on the page it came
 * from with a sentence rather than a JSON error.
 */
export async function GET(request: Request, { params }: { params: Promise<{ connector: string }> }) {
  const { connector: connectorId } = await params;
  const url = new URL(request.url);
  const projectHandle = url.searchParams.get("project") ?? "";
  const requested = url.searchParams.get("returnTo") ?? "";
  const returnTo =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : `/p/${projectHandle}/integrations`;
  const fail = (message: string) => NextResponse.redirect(backTo(request, returnTo, { connectError: message }));

  const user = await currentUser();
  if (!user) return NextResponse.redirect(backTo(request, "/login", {}));
  const project = await findProject(projectHandle, user.id);
  if (!project) return fail("That project no longer exists.");
  if (!roleAtLeast(await membershipOf(user.id, project.organizationId), "admin")) {
    return fail("Only an owner or admin can connect tools.");
  }

  const connector = connectorById(connectorId);
  const provider = connector?.oauthProvider;
  if (!connector || connector.status !== "available" || !provider) return fail("That connection is not available yet.");
  if (!oauthConfigured(provider)) {
    return fail(`${connector.name} is not set up on this server yet. Ask whoever deploys Desker to add its app credentials.`);
  }
  if (!vaultConfigured()) return fail("Connections cannot be stored until the server has a VAULT_KEY.");

  const { token, nonce } = signState({
    organizationId: project.organizationId,
    userId: user.id,
    connectorId: connector.id,
    returnTo,
  });
  const pkce = usesPkce(provider) ? pkcePair() : null;
  const response = NextResponse.redirect(
    authorizeUrl(provider, callbackUrl(request, provider), token, connector.scope, pkce?.challenge),
  );
  const cookie = { httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", path: "/api/integrations/oauth", maxAge: 600 };
  response.cookies.set(NONCE_COOKIE, nonce, cookie);
  if (pkce) response.cookies.set(PKCE_COOKIE, pkce.verifier, cookie);
  return response;
}
