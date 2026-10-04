import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CommitmentType, CommitmentOwnerRole } from "@/lib/commitments/types";

// Mock prisma for commitment operations
vi.mock("@/lib/platform/db", () => ({
  prisma: {
    commitment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    lifeEntry: {
      findUnique: vi.fn(),
    },
    lifeEvent: {
      findUnique: vi.fn(),
    },
    teamMessage: {
      findFirst: vi.fn(),
    },
    actionItem: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/platform/db";
import {
  createCommitment,
  updateCommitment,
  closeCommitment,
  listCommitments,
  verifyAndCloseSignals,
  evaluateFollowUps,
} from "@/lib/commitments/store";

describe("commitments data model and escalation logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("models commitment types and owners cleanly", () => {
    const todo: { type: CommitmentType; ownerRole: CommitmentOwnerRole; outcome: string } = {
      type: "to_do",
      ownerRole: "user",
      outcome: "Submit tax return",
    };
    expect(todo.type).toBe("to_do");
    expect(todo.ownerRole).toBe("user");

    const waitingOn: { type: CommitmentType; ownerRole: CommitmentOwnerRole; ownerName: string; outcome: string } = {
      type: "waiting_on",
      ownerRole: "other",
      ownerName: "Nok",
      outcome: "Send signed contract",
    };
    expect(waitingOn.type).toBe("waiting_on");
    expect(waitingOn.ownerName).toBe("Nok");
  });

  it("creates a commitment with open status and initial activity log", async () => {
    const now = new Date();
    vi.mocked(prisma.commitment.create).mockResolvedValue({
      id: "c-1",
      projectId: "p1",
      type: "waiting_on",
      ownerRole: "other",
      ownerName: "Nok",
      outcome: "Send contract",
      dueAt: new Date(now.getTime() + 86400000),
      status: "open",
      snoozedUntil: null,
      sourceRef: "line:msg123",
      checkSignal: null,
      activityLog: [{ at: now.toISOString(), action: "created", note: "Commitment opened" }],
      nudgeCount: 0,
      lastNudgeAt: null,
      followUpDraft: null,
      closedAt: null,
      closedReason: null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await createCommitment({
      projectId: "p1",
      type: "waiting_on",
      ownerRole: "other",
      ownerName: "Nok",
      outcome: "Send contract",
      dueAt: new Date(now.getTime() + 86400000).toISOString(),
      sourceRef: "line:msg123",
    });

    expect(created.id).toBe("c-1");
    expect(created.status).toBe("open");
    expect(created.ownerName).toBe("Nok");
    expect(created.activityLog).toHaveLength(1);
    expect(prisma.commitment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          type: "waiting_on",
          ownerName: "Nok",
          outcome: "Send contract",
        }),
      }),
    );
  });

  it("updates commitment fields and appends to activity log", async () => {
    const existing = {
      id: "c-1",
      projectId: "p1",
      type: "to_do",
      ownerRole: "user",
      ownerName: null,
      outcome: "Review draft",
      dueAt: null,
      status: "open",
      snoozedUntil: null,
      sourceRef: null,
      checkSignal: null,
      activityLog: [{ at: "2026-10-01T00:00:00Z", action: "created", note: "Opened" }],
      nudgeCount: 0,
      lastNudgeAt: null,
      followUpDraft: null,
      closedAt: null,
      closedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(existing);
    vi.mocked(prisma.commitment.update).mockResolvedValue({
      ...existing,
      status: "snoozed",
      activityLog: [
        ...existing.activityLog,
        { at: "2026-10-04T00:00:00Z", action: "status_snoozed", note: "Snoozed until Monday" },
      ],
    });

    const updated = await updateCommitment({
      id: "c-1",
      projectId: "p1",
      status: "snoozed",
      note: "Snoozed until Monday",
    });

    expect(updated.status).toBe("snoozed");
    expect(prisma.commitment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ status: "snoozed" }),
      }),
    );
  });

  it("closes a commitment as done or dropped with reason and activity log", async () => {
    const existing = {
      id: "c-1",
      projectId: "p1",
      type: "waiting_on",
      ownerRole: "other",
      ownerName: "Nok",
      outcome: "Send contract",
      dueAt: null,
      status: "open",
      snoozedUntil: null,
      sourceRef: null,
      checkSignal: null,
      activityLog: [],
      nudgeCount: 1,
      lastNudgeAt: null,
      followUpDraft: null,
      closedAt: null,
      closedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(existing);
    vi.mocked(prisma.commitment.update).mockResolvedValue({
      ...existing,
      status: "done",
      closedAt: new Date(),
      closedReason: "Contract received",
    });

    const closed = await closeCommitment("c-1", "p1", "done", "Contract received");
    expect(closed.status).toBe("done");
    expect(closed.closedReason).toBe("Contract received");
    expect(prisma.commitment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({
          status: "done",
          closedReason: "Contract received",
        }),
      }),
    );
  });

  it("lists active commitments with status and type filters", async () => {
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      {
        id: "c-active",
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Clean inbox",
        dueAt: null,
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const activeList = await listCommitments("p1", { status: "active", type: "to_do" });
    expect(activeList).toHaveLength(1);
    expect(activeList[0]?.outcome).toBe("Clean inbox");
    expect(prisma.commitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "p1",
          status: { in: ["open", "waiting", "snoozed"] },
          type: "to_do",
        }),
      }),
    );
  });

  it("verifies and closes checkable signals automatically", async () => {
    const now = new Date();
    // 1. Bill paid signal
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      {
        id: "c-bill",
        projectId: "p1",
        type: "recurring",
        ownerRole: "user",
        ownerName: null,
        outcome: "Pay electricity bill",
        dueAt: now,
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: "bill_paid:bill-1",
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "c-reply",
        projectId: "p1",
        type: "waiting_on",
        ownerRole: "other",
        ownerName: "Supplier",
        outcome: "Wait for quote",
        dueAt: now,
        status: "waiting",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: "reply_arrived:thread-1",
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: new Date(now.getTime() - 10000),
        updatedAt: now,
      },
    ]);

    vi.mocked(prisma.lifeEntry.findUnique).mockResolvedValue({ status: "paid" } as never);
    vi.mocked(prisma.teamMessage.findFirst).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.commitment.findUnique).mockImplementation(((args: { where: { id: string } }) => {
      const { where } = args;
      return Promise.resolve({
        id: where.id,
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Outcome",
        dueAt: null,
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }) as unknown as never);
    vi.mocked(prisma.commitment.update).mockImplementation(((args: { where: { id: string }; data: { status?: string; closedReason?: string } }) => {
      const { where, data } = args;
      return Promise.resolve({
        id: where.id,
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Outcome",
        dueAt: null,
        status: data.status || "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: new Date(),
        closedReason: data.closedReason || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }) as unknown as never);

    const closed = await verifyAndCloseSignals("p1");
    expect(closed).toHaveLength(2);
    expect(closed[0]?.closedReason).toContain("Verified: bill paid");
    expect(closed[1]?.closedReason).toContain("Verified: reply arrived");
  });

  it("evaluates follow-ups with 2-nudge escalation, follow-up draft for waiting-on, and stops nagging", async () => {
    const now = new Date();
    // Test Nudge 1 (nudgeCount: 0)
    vi.mocked(prisma.commitment.findMany).mockResolvedValueOnce([
      {
        id: "c-nudge1",
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Renew insurance",
        dueAt: new Date(now.getTime() - 1000),
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 0,
        lastNudgeAt: null,
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    vi.mocked(prisma.commitment.update).mockResolvedValue({} as never);

    const nudges1 = await evaluateFollowUps("p1", now);
    expect(nudges1).toHaveLength(1);
    expect(nudges1[0]?.nudgeLevel).toBe(1);
    expect(nudges1[0]?.message).toContain("Due today");
    expect(nudges1[0]?.actionChips).toEqual(["Done", "Not yet", "Drop"]);
    expect(prisma.commitment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-nudge1" },
        data: expect.objectContaining({ nudgeCount: 1 }),
      }),
    );

    // Test Nudge 2 with draft for waiting-on item (nudgeCount: 1)
    vi.mocked(prisma.commitment.findMany).mockResolvedValueOnce([
      {
        id: "c-nudge2",
        projectId: "p1",
        type: "waiting_on",
        ownerRole: "other",
        ownerName: "Nok",
        outcome: "Send signed contract",
        dueAt: new Date(now.getTime() - 86400000),
        status: "waiting",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 1,
        lastNudgeAt: new Date(now.getTime() - 86400000),
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const nudges2 = await evaluateFollowUps("p1", now);
    expect(nudges2).toHaveLength(1);
    expect(nudges2[0]?.nudgeLevel).toBe(2);
    expect(nudges2[0]?.draft).toContain("Hi Nok, just following up on: Send signed contract");
    expect(nudges2[0]?.message).toContain("Here is a follow-up draft you can send them");
    expect(nudges2[0]?.actionChips).toEqual(["Done", "Reschedule", "Drop"]);

    // Test Nudge 3 / escalation stop (nudgeCount: 2) -> asks once to reschedule/drop
    vi.mocked(prisma.commitment.findMany).mockResolvedValueOnce([
      {
        id: "c-nudge3",
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Submit report",
        dueAt: new Date(now.getTime() - 172800000),
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 2,
        lastNudgeAt: new Date(now.getTime() - 86400000),
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const nudges3 = await evaluateFollowUps("p1", now);
    expect(nudges3).toHaveLength(1);
    expect(nudges3[0]?.nudgeLevel).toBe(3);
    expect(nudges3[0]?.message).toContain("Should we reschedule or drop this loop?");
    expect(nudges3[0]?.actionChips).toEqual(["Done", "Reschedule", "Drop"]);

    // Test nudgeCount >= 3 -> does not nag further
    vi.mocked(prisma.commitment.findMany).mockResolvedValueOnce([
      {
        id: "c-nudge4",
        projectId: "p1",
        type: "to_do",
        ownerRole: "user",
        ownerName: null,
        outcome: "Submit report",
        dueAt: new Date(now.getTime() - 250000000),
        status: "open",
        snoozedUntil: null,
        sourceRef: null,
        checkSignal: null,
        activityLog: [],
        nudgeCount: 3,
        lastNudgeAt: new Date(now.getTime() - 86400000),
        followUpDraft: null,
        closedAt: null,
        closedReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const nudges4 = await evaluateFollowUps("p1", now);
    expect(nudges4).toHaveLength(0);
  });
});
