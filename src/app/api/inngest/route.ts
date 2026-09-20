import { serve } from "inngest/next";
import { functions, inngest } from "@/lib/jobs";
import { env } from "@/lib/env";

// Prisma needs Node; the Inngest dev server and Inngest Cloud both call this
// route to discover functions (PUT) and to execute them (POST).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  // Register under the stable public origin, never the per-deployment URL the
  // request may have arrived on. On Vercel those URLs sit behind deployment
  // protection, so a registration made through one would leave Inngest
  // calling a login page and the schedule silently dead.
  ...(env.appUrl ? { serveOrigin: env.appUrl } : {}),
  servePath: "/api/inngest",
});
