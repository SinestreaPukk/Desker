import "server-only";
import { prisma } from "@/lib/platform/db";
import type { CommitmentType, CommitmentStatus, CommitmentOwnerRole, CommitmentActivityEntry, CommitmentDto } from "./types";

export interface CreateCommitmentInput {
  projectId: string;
  type: CommitmentType;
  outcome: string;
  dueAt?: string | Date;
  ownerRole?: CommitmentOwnerRole;
  ownerName?: string;
  sourceRef?: string;
  checkSignal?: string;
}

export interface UpdateCommitmentInput {
  id: string;
  projectId: string;
  outcome?: string;
  dueAt?: string | Date | null;
  status?: CommitmentStatus;
  snoozedUntil?: string | Date | null;
  followUpDraft?: string | null;
  note?: string;
}

export async function createCommitment(input: CreateCommitmentInput): Promise<CommitmentDto> {
  const { projectId, type, outcome, ownerRole = "user", ownerName, sourceRef, checkSignal } = input;
  const cleanOutcome = outcome.trim();
  if (!cleanOutcome) throw new Error("Commitment outcome cannot be empty.");

  const now = new Date();
  const dueAtDate = input.dueAt ? new Date(input.dueAt) : null;

  const initialLog: CommitmentActivityEntry[] = [
    { at: now.toISOString(), action: "created", note: "Commitment opened" },
  ];

  const row = await prisma.commitment.create({
    data: {
      projectId,
      type,
      outcome: cleanOutcome,
      ownerRole,
      ownerName: ownerName?.trim() || null,
      dueAt: dueAtDate && !isNaN(dueAtDate.getTime()) ? dueAtDate : null,
      status: "open",
      sourceRef: sourceRef ?? null,
      checkSignal: checkSignal ?? null,
      activityLog: initialLog as object,
    },
  });

  return toDto(row);
}

export async function updateCommitment(input: UpdateCommitmentInput): Promise<CommitmentDto> {
  const { id, projectId, outcome, status, followUpDraft, note } = input;
  const existing = await prisma.commitment.findUnique({
    where: { id },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new Error("Commitment not found.");
  }

  const now = new Date();
  const logs = (Array.isArray(existing.activityLog)
    ? (existing.activityLog as unknown as CommitmentActivityEntry[])
    : []) as CommitmentActivityEntry[];

  if (note || status || outcome) {
    logs.push({
      at: now.toISOString(),
      action: status ? `status_${status}` : "updated",
      note: note || (status ? `Status changed to ${status}` : "Commitment updated"),
    });
  }

  const dueAtDate = input.dueAt !== undefined
    ? input.dueAt === null ? null : new Date(input.dueAt)
    : undefined;

  const snoozedUntilDate = input.snoozedUntil !== undefined
    ? input.snoozedUntil === null ? null : new Date(input.snoozedUntil)
    : undefined;

  const updated = await prisma.commitment.update({
    where: { id },
    data: {
      ...(outcome !== undefined ? { outcome: outcome.trim() } : {}),
      ...(dueAtDate !== undefined ? { dueAt: dueAtDate } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(snoozedUntilDate !== undefined ? { snoozedUntil: snoozedUntilDate } : {}),
      ...(followUpDraft !== undefined ? { followUpDraft } : {}),
      activityLog: logs as object,
      updatedAt: now,
    },
  });

  return toDto(updated);
}

export async function closeCommitment(
  id: string,
  projectId: string,
  status: "done" | "dropped",
  reason?: string,
): Promise<CommitmentDto> {
  const existing = await prisma.commitment.findUnique({
    where: { id },
  });
  if (!existing || existing.projectId !== projectId) {
    throw new Error("Commitment not found.");
  }

  const now = new Date();
  const logs = (Array.isArray(existing.activityLog)
    ? (existing.activityLog as unknown as CommitmentActivityEntry[])
    : []) as CommitmentActivityEntry[];

  logs.push({
    at: now.toISOString(),
    action: `closed_${status}`,
    note: reason || `Closed as ${status}`,
  });

  const updated = await prisma.commitment.update({
    where: { id },
    data: {
      status,
      closedAt: now,
      closedReason: reason || `Marked ${status}`,
      activityLog: logs as object,
      updatedAt: now,
    },
  });

  return toDto(updated);
}

export async function listCommitments(
  projectId: string,
  filter?: {
    status?: string;
    type?: CommitmentType;
    ownerName?: string;
  },
): Promise<CommitmentDto[]> {
  const where: {
    projectId: string;
    status?: string | { in: string[] };
    type?: string;
    ownerName?: string;
  } = { projectId };

  if (filter?.status) {
    if (filter.status === "active") {
      where.status = { in: ["open", "waiting", "snoozed"] };
    } else {
      where.status = filter.status;
    }
  }

  if (filter?.type) where.type = filter.type;
  if (filter?.ownerName) where.ownerName = filter.ownerName;

  const rows = await prisma.commitment.findMany({
    where,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return rows.map(toDto);
}

/** Checkable signal evaluation: auto-closes commitments when signal is verified. */
export async function verifyAndCloseSignals(projectId: string): Promise<CommitmentDto[]> {
  const openWithSignals = await prisma.commitment.findMany({
    where: {
      projectId,
      status: { in: ["open", "waiting"] },
      checkSignal: { not: null },
    },
  });

  const closed: CommitmentDto[] = [];

  for (const item of openWithSignals) {
    const signal = item.checkSignal!;
    if (signal.startsWith("bill_paid:")) {
      const billId = signal.slice(10);
      const bill = await prisma.lifeEntry.findUnique({
        where: { id: billId },
        select: { status: true },
      });
      if (bill && bill.status === "paid") {
        const c = await closeCommitment(item.id, projectId, "done", "Verified: bill paid.");
        closed.push(c);
      }
    } else if (signal.startsWith("event_passed:")) {
      const eventId = signal.slice(13);
      const ev = await prisma.lifeEvent.findUnique({
        where: { id: eventId },
        select: { startsAt: true, endsAt: true },
      });
      const now = new Date();
      if (ev && (ev.endsAt ? ev.endsAt < now : ev.startsAt < now)) {
        const c = await closeCommitment(item.id, projectId, "done", "Verified: event has taken place.");
        closed.push(c);
      }
    } else if (signal.startsWith("reply_arrived:")) {
      const threadOrChannelId = signal.slice(14);
      const reply = await prisma.teamMessage.findFirst({
        where: {
          threadId: threadOrChannelId,
          createdAt: { gt: item.createdAt },
        },
      });
      if (reply) {
        const c = await closeCommitment(item.id, projectId, "done", "Verified: reply arrived.");
        closed.push(c);
      }
    } else if (signal.startsWith("action_completed:")) {
      const actionId = signal.slice(17);
      const action = await prisma.actionItem.findUnique({
        where: { id: actionId },
        select: { status: true },
      });
      if (action && (action.status === "completed" || action.status === "approved")) {
        const c = await closeCommitment(item.id, projectId, "done", "Verified: action completed.");
        closed.push(c);
      }
    }
  }

  return closed;
}

export interface NudgeEvaluation {
  commitment: CommitmentDto;
  nudgeLevel: 1 | 2 | 3;
  message: string;
  draft?: string;
  actionChips: string[];
}

/** Evaluates open commitments for follow-up logic: nudge 1, nudge 2 (with draft), ask once to reschedule/drop. */
export async function evaluateFollowUps(projectId: string, now = new Date()): Promise<NudgeEvaluation[]> {
  const activeItems = await prisma.commitment.findMany({
    where: {
      projectId,
      status: { in: ["open", "waiting"] },
      dueAt: { lte: now },
    },
  });

  const nudges: NudgeEvaluation[] = [];

  for (const item of activeItems) {
    const isWaitingOn = item.type === "waiting_on";
    const who = item.ownerName || "the other person";

    if (item.nudgeCount === 0) {
      // Nudge 1: gentle nudge at due date
      const msg = isWaitingOn
        ? `Nudge: Waiting on ${who} for: "${item.outcome}". Due today.`
        : `Nudge: Due today: "${item.outcome}".`;

      await prisma.commitment.update({
        where: { id: item.id },
        data: { nudgeCount: 1, lastNudgeAt: now },
      });

      nudges.push({
        commitment: toDto(item),
        nudgeLevel: 1,
        message: msg,
        actionChips: ["Done", "Not yet", "Drop"],
      });
    } else if (item.nudgeCount === 1) {
      // Nudge 2: after due date. Waiting-on gets a follow-up draft (never sent unprompted).
      let draft: string | undefined;
      let msg = "";

      if (isWaitingOn) {
        draft = `Hi ${who}, just following up on: ${item.outcome}. Let me know if you need anything from me!`;
        msg = `${who} is late on: "${item.outcome}". Here is a follow-up draft you can send them:\n\n"${draft}"`;
      } else {
        msg = `Overdue: "${item.outcome}".`;
      }

      await prisma.commitment.update({
        where: { id: item.id },
        data: { nudgeCount: 2, lastNudgeAt: now, followUpDraft: draft ?? null },
      });

      nudges.push({
        commitment: toDto(item),
        nudgeLevel: 2,
        message: msg,
        draft,
        actionChips: ["Done", "Reschedule", "Drop"],
      });
    } else if (item.nudgeCount === 2) {
      // Escalation stop: ask once whether to reschedule or drop. Never nag past that.
      const msg = `Past due: "${item.outcome}". Should we reschedule or drop this loop?`;
      await prisma.commitment.update({
        where: { id: item.id },
        data: { nudgeCount: 3, lastNudgeAt: now },
      });

      nudges.push({
        commitment: toDto(item),
        nudgeLevel: 3,
        message: msg,
        actionChips: ["Done", "Reschedule", "Drop"],
      });
    }
  }

  return nudges;
}

function toDto(row: {
  id: string;
  projectId: string;
  type: string;
  ownerRole: string;
  ownerName: string | null;
  outcome: string;
  dueAt: Date | null;
  status: string;
  snoozedUntil: Date | null;
  sourceRef: string | null;
  checkSignal: string | null;
  activityLog: unknown;
  nudgeCount: number;
  lastNudgeAt: Date | null;
  followUpDraft: string | null;
  closedAt: Date | null;
  closedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommitmentDto {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as CommitmentType,
    ownerRole: row.ownerRole as CommitmentOwnerRole,
    ownerName: row.ownerName,
    outcome: row.outcome,
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status as CommitmentStatus,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    sourceRef: row.sourceRef,
    checkSignal: row.checkSignal,
    activityLog: Array.isArray(row.activityLog)
      ? (row.activityLog as unknown as CommitmentActivityEntry[])
      : [],
    nudgeCount: row.nudgeCount,
    lastNudgeAt: row.lastNudgeAt?.toISOString() ?? null,
    followUpDraft: row.followUpDraft,
    closedAt: row.closedAt?.toISOString() ?? null,
    closedReason: row.closedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
