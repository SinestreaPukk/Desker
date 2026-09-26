import { NextResponse } from "next/server";
import { heartbeatStatus } from "@/lib/jobs/heartbeat";
import { workQueueStatus } from "@/lib/work/watchdog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The scheduler's own health check, for an uptime monitor: 200 while the
 * heartbeat is fresh and autonomous work is flowing, 503 once two intervals
 * pass without a heartbeat or work has waited in the queue past its budget.
 * Point whatever pages you - Better Stack, UptimeRobot, Checkly - at this URL.
 */
export async function GET() {
  const [jobs, work] = await Promise.all([
    heartbeatStatus().catch(() => null),
    workQueueStatus().catch(() => null),
  ]);
  const alive = jobs?.alive ?? false;
  const flowing = work ? !work.backlogged : false;
  const ok = alive && flowing;
  return NextResponse.json(
    {
      ok,
      ...(jobs ?? { lastHeartbeatAt: null, ageMs: null, intervalMs: null, alive: false }),
      work: work ?? null,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
