/**
 * The audit trail: who did what to which thing.
 *
 * Every side-effecting action a person, an agent, or a schedule takes goes
 * through `audit()`. It never throws - a failed audit write is logged, because
 * the action it describes has already happened and must not be rolled back by
 * a bookkeeping failure. Secrets never belong in `metadata`.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AuditActorType = "user" | "agent" | "system" | "schedule";

export interface AuditEntry {
  organizationId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  /** Dotted verb, e.g. "organization.created", "agent.published". */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function audit(
  entry: AuditEntry,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: entry.organizationId ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", entry.action, error);
  }
}
