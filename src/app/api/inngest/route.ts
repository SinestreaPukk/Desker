import { serve } from "inngest/next";
import { functions, inngest } from "@/lib/jobs";

// Prisma needs Node; the Inngest dev server and Inngest Cloud both call this
// route to discover functions (PUT) and to execute them (POST).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
