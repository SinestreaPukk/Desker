import { handle, requireAdmin } from "@/lib/api";
import { OAUTH_PROVIDERS } from "@/lib/integrations/catalog";
import { oauthConfigured } from "@/lib/integrations/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which sign-in providers this server has credentials for, so a card can say "not set up here" honestly. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return Object.fromEntries(OAUTH_PROVIDERS.map((provider) => [provider, oauthConfigured(provider)])) as Record<
      (typeof OAUTH_PROVIDERS)[number],
      boolean
    >;
  });
}
