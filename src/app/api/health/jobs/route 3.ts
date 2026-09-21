import { NextResponse } from "next/server";
import { heartbeatStatus } from "@/lib/jobs/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The scheduler's own health check, for an uptime monitor: 200 while the
 * heartbeat is fresh, 503 once two intervals have passed without one. Point
 * whatever pages you - Better Stack, UptimeRobot, Checkly - at this URL.
 */
export async function GET() {
  const jobs = await heartbeatStatus().catch(() => null);
  const alive = jobs?.alive ?? false;
  return NextResponse.json(
    { ok: alive, ...(jobs ?? { lastHeartbeatAt: null, ageMs: null, intervalMs: null, alive: false }) },
    { status: alive ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
