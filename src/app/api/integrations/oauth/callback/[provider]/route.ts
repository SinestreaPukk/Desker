import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { membershipOf, roleAtLeast } from "@/lib/organizations";
import { audit } from "@/lib/audit";
import { OAUTH_PROVIDERS, connectorById, type OAuthProvider } from "@/lib/integrations/catalog";
import { exchangeCode, saveConnection, verifyState } from "@/lib/integrations/oauth";
import { NONCE_COOKIE, backTo, callbackUrl } from "@/lib/integrations/oauth-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where the provider sends the owner back: check the state, swap the code, store the tokens sealed. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const jar = await cookies();
  const state = verifyState(url.searchParams.get("state") ?? "", jar.get(NONCE_COOKIE)?.value);
  jar.delete({ name: NONCE_COOKIE, path: "/api/integrations/oauth" });

  if (!state) {
    return NextResponse.redirect(
      backTo(request, "/", { connectError: "That connection attempt expired or did not start here. Try Connect again." }),
    );
  }
  const fail = (message: string) => NextResponse.redirect(backTo(request, state.returnTo, { connectError: message }));

  const connector = connectorById(state.connectorId);
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(provider) || connector?.oauthProvider !== provider) {
    return fail("That connection came back from the wrong place.");
  }
  // The person finishing must be the person who started, and still an admin.
  const user = await currentUser();
  if (!user || user.id !== state.userId) return fail("Sign in as the person who started the connection.");
  if (!roleAtLeast(await membershipOf(user.id, state.organizationId), "admin")) {
    return fail("Only an owner or admin can connect tools.");
  }

  const denied = url.searchParams.get("error");
  if (denied) return fail(`${connector.name} was not connected: you declined on its page.`);
  const code = url.searchParams.get("code");
  if (!code) return fail(`${connector.name} did not send back an approval. Try again.`);

  try {
    const { tokens, account } = await exchangeCode(provider as OAuthProvider, code, callbackUrl(request, provider));
    const row = await saveConnection({
      organizationId: state.organizationId,
      connectorId: connector.id,
      tokens,
      account,
    });
    await audit({
      organizationId: state.organizationId,
      actorType: "user",
      actorId: user.id,
      action: "integration.connected",
      targetType: "integration",
      targetId: row.id,
      metadata: { type: row.type, name: row.name, via: "oauth" },
    });
  } catch (error) {
    return fail(`${connector.name} was not connected: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  return NextResponse.redirect(backTo(request, state.returnTo, { connected: connector.id }));
}
