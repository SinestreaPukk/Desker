import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject, agentsVisibleTo } from "@/lib/tenancy/projects";
import { GATED_TOOL_IDS } from "@/lib/work/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;
// ponytail: tool-call rows are filtered in memory because Json path filters
// differ between SQLite and Postgres; a week of one project's calls is small.
// Record a `<tool>.delivered` row for auto sends too if this ever gets slow.

export interface ActivityDto {
  days: number;
  done: number;
  /** Went out (email, post, event, message) after a person approved it. */
  sentApproved: number;
  /** Went out on its own because the owner put that tool in auto mode. */
  sentOnItsOwn: number;
  waiting: number;
  escalated: number;
}

/**
 * The last week of work in the few numbers that answer "can I trust it?":
 * what got done, what reached the outside world and on whose say-so, and
 * what is waiting for a person. Read from the same records as the Audit log.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const projectHandle = new URL(request.url).searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) throw new HttpError(404, "That project no longer exists.");

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const agent = project ? { projectId: project.id } : agentsVisibleTo(userId);

    // An approved action is recorded as `<tool>.delivered` once it goes out;
    // one sent in auto mode only as the tool call itself, marked not gated.
    const [done, waiting, escalated, rows] = await Promise.all([
      prisma.actionItem.count({ where: { agent, status: "done", completedAt: { gte: since } } }),
      prisma.actionItem.count({ where: { agent, status: "needs_approval" } }),
      prisma.actionItem.count({ where: { agent, escalatedAt: { gte: since } } }),
      prisma.auditLog.findMany({
        where: {
          OR: [{ action: { endsWith: ".delivered" } }, { action: "tool.called" }],
          targetType: "action_item",
          createdAt: { gte: since },
        },
        select: { action: true, targetId: true, metadata: true },
      }),
    ]);
    const sent = rows.filter((row) => {
      if (row.action !== "tool.called") return true;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return (GATED_TOOL_IDS as readonly unknown[]).includes(meta.tool) && meta.ok !== false && meta.gated === false;
    });
    // Only this project's runs.
    const ours = new Set(
      (
        await prisma.actionItem.findMany({
          where: { id: { in: [...new Set(sent.map((row) => row.targetId!))] }, agent },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    let sentApproved = 0;
    let sentOnItsOwn = 0;
    for (const row of sent) {
      if (!ours.has(row.targetId!)) continue;
      if (row.action === "tool.called") sentOnItsOwn++;
      else sentApproved++;
    }

    return { days: WINDOW_DAYS, done, sentApproved, sentOnItsOwn, waiting, escalated } satisfies ActivityDto;
  });
}
