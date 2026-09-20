import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { findProject } from "@/lib/projects";
import { organizationsFor } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AuditEntryDto {
  id: string;
  at: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The audit trail, queryable and exportable. Scoped to the organisation that
 * owns the project (or every organisation the caller belongs to). Rows are
 * never edited or deleted from here; this only reads.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const url = new URL(request.url);

    const projectHandle = url.searchParams.get("project");
    const project = projectHandle ? await findProject(projectHandle, userId) : null;
    if (projectHandle && !project) throw new HttpError(404, "That project no longer exists.");
    const organizationIds = project
      ? [project.organizationId]
      : (await organizationsFor(userId)).map((org) => org.id);

    const agentId = url.searchParams.get("agentId");
    const action = url.searchParams.get("action")?.trim();
    const actorType = url.searchParams.get("actorType");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get("limit") ?? (format === "csv" ? "5000" : "200"), 10) || 200, 1),
      format === "csv" ? 50_000 : 1000,
    );

    // "Per agent" means rows the agent performed plus rows about the agent's
    // own work items and conversations - the whole story of one employee.
    let agentScope: Prisma.AuditLogWhereInput = {};
    if (agentId) {
      const [items, conversations] = await Promise.all([
        prisma.actionItem.findMany({ where: { agentId }, select: { id: true } }),
        prisma.conversation.findMany({ where: { agentId }, select: { id: true } }),
      ]);
      agentScope = {
        OR: [
          { actorType: "agent", actorId: agentId },
          { targetType: "agent", targetId: agentId },
          { targetType: "action_item", targetId: { in: items.map((i) => i.id) } },
          { targetType: "conversation", targetId: { in: conversations.map((c) => c.id) } },
        ],
      };
    }

    const where: Prisma.AuditLogWhereInput = {
      organizationId: { in: organizationIds },
      ...agentScope,
      ...(action ? { action: { startsWith: action } } : {}),
      ...(actorType && actorType !== "all" ? { actorType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Names for actors, so an export reads "Mia" rather than a cuid.
    const agentIds = [...new Set(rows.filter((r) => r.actorType === "agent" && r.actorId).map((r) => r.actorId!))];
    const userIds = [...new Set(rows.filter((r) => r.actorType === "user" && r.actorId).map((r) => r.actorId!))];
    const [agents, users] = await Promise.all([
      prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }),
    ]);
    const names = new Map<string, string>([
      ...agents.map((a) => [a.id, a.name] as const),
      ...users.map((u) => [u.id, u.name ?? u.email] as const),
    ]);

    const entries: AuditEntryDto[] = rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      actorType: row.actorType,
      actorId: row.actorId,
      actorName: row.actorId ? (names.get(row.actorId) ?? null) : null,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    }));

    if (format === "csv") {
      const header = ["at", "actor_type", "actor", "action", "target_type", "target_id", "tool", "trigger", "ok", "input", "result", "metadata"];
      const lines = [header.join(",")];
      for (const entry of entries) {
        const m = entry.metadata ?? {};
        lines.push(
          [
            entry.at,
            entry.actorType,
            entry.actorName ?? entry.actorId ?? "",
            entry.action,
            entry.targetType ?? "",
            entry.targetId ?? "",
            m.tool ?? "",
            m.trigger ?? "",
            m.ok === undefined ? "" : String(m.ok),
            m.input ?? "",
            m.result ?? "",
            entry.metadata,
          ]
            .map(csvCell)
            .join(","),
        );
      }
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="desker-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return entries;
  });
}
