import { NextResponse } from "next/server";
import { fireDueScopes } from "@/lib/work/scope";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Triggers due scheduled scopes of work.
 *
 * Supports:
 * - Vercel Cron or external cron systems via Authorization: Bearer <CRON_SECRET>
 * - Admin users triggering the cron tick from the dashboard
 * - Local development and test environments when CRON_SECRET is not configured
 */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
    const valid = bearer === secret || headerSecret === secret;

    if (!valid) {
      const user = await currentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }
  }

  try {
    const started = await fireDueScopes();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      started,
      count: started.length,
    });
  } catch (error) {
    console.error("[cron/work] failed to fire due scopes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error while firing scopes." },
      { status: 500 },
    );
  }
}
