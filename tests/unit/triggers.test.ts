import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock DB and messaging
vi.mock("@/lib/platform/db", () => ({
  prisma: {
    triggerRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    triggerExecutionLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    messageChannel: {
      findFirst: vi.fn(),
    },
    teamMessage: {
      findFirst: vi.fn(),
    },
    teamThread: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/messaging/line", () => ({
  linePush: vi.fn().mockResolvedValue(true),
  replyMessages: vi.fn().mockReturnValue([{ type: "text", text: "message" }]),
}));

vi.mock("@/lib/agents/team", () => ({
  addTeamMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
}));

import { prisma } from "@/lib/platform/db";
import { linePush } from "@/lib/messaging/line";
import { addTeamMessage } from "@/lib/agents/team";
import {
  isWithinQuietHours,
  ensureStarterRules,
  listTriggerRules,
  updateTriggerRule,
  evaluateAndFireTrigger,
  whyDidYouMessage,
  whyDidntYouMessage,
  recordFeedback,
} from "@/lib/triggers/engine";

describe("proactive triggers and notification discipline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("quiet hours calculation", () => {
    it("calculates quiet hours overnight window correctly", () => {
      // 23:30 is inside 22:00-07:00
      const lateNight = new Date("2026-10-04T23:30:00Z");
      expect(isWithinQuietHours(lateNight, "UTC", "22:00", "07:00")).toBe(true);

      // 03:15 is inside 22:00-07:00
      const earlyMorning = new Date("2026-10-04T03:15:00Z");
      expect(isWithinQuietHours(earlyMorning, "UTC", "22:00", "07:00")).toBe(true);

      // 14:00 is outside 22:00-07:00
      const daytime = new Date("2026-10-04T14:00:00Z");
      expect(isWithinQuietHours(daytime, "UTC", "22:00", "07:00")).toBe(false);

      // 08:30 is outside 22:00-07:00
      const morning = new Date("2026-10-04T08:30:00Z");
      expect(isWithinQuietHours(morning, "UTC", "22:00", "07:00")).toBe(false);
    });

    it("handles daytime quiet window correctly", () => {
      const noon = new Date("2026-10-04T12:30:00Z");
      expect(isWithinQuietHours(noon, "UTC", "12:00", "13:00")).toBe(true);

      const evening = new Date("2026-10-04T18:00:00Z");
      expect(isWithinQuietHours(evening, "UTC", "12:00", "13:00")).toBe(false);
    });
  });

  describe("starter rules and updates", () => {
    it("ensures starter rules exist for new project", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.triggerRule.create).mockResolvedValue({} as never);

      await ensureStarterRules("p1");
      // 5 starter rules: morning_brief, conflict_alert, due_soon_alert, weekly_digest, waiting_on_late
      expect(prisma.triggerRule.create).toHaveBeenCalledTimes(5);
    });

    it("lists trigger rules for project", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([
        {
          id: "r1",
          projectId: "p1",
          name: "morning_brief",
          description: "Morning brief at 07:30",
          kind: "time",
          config: { time: "07:30" },
          enabled: true,
          feedback: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never);

      const rules = await listTriggerRules("p1");
      expect(rules).toHaveLength(1);
      expect(rules[0]?.name).toBe("morning_brief");
      expect(rules[0]?.config.time).toBe("07:30");
    });

    it("updates rule time, quiet hours, and suppresses topics", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "morning_brief" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r1",
        projectId: "p1",
        name: "morning_brief",
        description: "Morning brief",
        kind: "time",
        config: { time: "08:00", quietHoursStart: "22:00", quietHoursEnd: "07:00" },
        enabled: true,
        feedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      vi.mocked(prisma.triggerRule.update).mockResolvedValue({
        id: "r1",
        projectId: "p1",
        name: "morning_brief",
        description: "Morning brief",
        kind: "time",
        config: { time: "07:30", quietHoursStart: "23:00", quietHoursEnd: "08:00", suppressedTopics: ["crypto"] },
        enabled: true,
        feedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const updated = await updateTriggerRule("p1", {
        ruleName: "morning_brief",
        time: "07:30",
        quietHoursStart: "23:00",
        quietHoursEnd: "08:00",
        addSuppressedTopic: "crypto",
      });

      expect(updated.config.time).toBe("07:30");
      expect(updated.config.suppressedTopics).toContain("crypto");
    });
  });

  describe("trigger evaluation and delivery policy", () => {
    it("suppresses trigger if rule is disabled", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "due_soon_alert" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-off",
        projectId: "p1",
        name: "due_soon_alert",
        kind: "condition",
        config: {},
        enabled: false,
      } as never);

      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "due_soon_alert",
        urgency: "today",
        content: "Due soon",
      });

      expect(res.fired).toBe(false);
      expect(res.decision).toBe("suppressed");
      expect(res.reason).toContain("disabled");
    });

    it("suppresses trigger if topic was muted by user", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "due_soon_alert" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-sub",
        projectId: "p1",
        name: "due_soon_alert",
        kind: "condition",
        config: { suppressedTopics: ["gym", "bills"] },
        enabled: true,
      } as never);

      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "due_soon_alert",
        urgency: "today",
        content: "Bill reminder",
        topic: "bills",
      });

      expect(res.fired).toBe(false);
      expect(res.decision).toBe("suppressed");
      expect(res.reason).toContain('topic "bills" was muted');
    });

    it("suppresses trigger during quiet hours unless urgency is now", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "morning_brief" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-mb",
        projectId: "p1",
        name: "morning_brief",
        kind: "time",
        config: { quietHoursStart: "00:00", quietHoursEnd: "23:59" },
        enabled: true,
      } as never);
      vi.mocked(prisma.triggerExecutionLog.findUnique).mockResolvedValue(null);

      // Low urgency "today" during quiet hours: suppressed & batched
      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "morning_brief",
        urgency: "today",
        content: "Morning brief",
      });

      expect(res.fired).toBe(false);
      expect(res.decision).toBe("suppressed");
      expect(res.reason).toContain("quiet hours");
    });

    it("delivers to LINE when user last replied via LINE", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "conflict_alert" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-ca",
        projectId: "p1",
        name: "conflict_alert",
        kind: "condition",
        config: { quietHoursStart: "23:00", quietHoursEnd: "05:00" },
        enabled: true,
      } as never);
      vi.mocked(prisma.triggerExecutionLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.triggerExecutionLog.count).mockResolvedValue(0);

      // User last replied in LINE
      vi.mocked(prisma.messageChannel.findFirst).mockResolvedValue({
        createdAt: new Date("2026-10-04T12:00:00Z"),
        target: "line-user-1",
        senderKey: "key-1",
      } as never);
      vi.mocked(prisma.teamMessage.findFirst).mockResolvedValue({
        createdAt: new Date("2026-10-04T10:00:00Z"),
      } as never);

      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "conflict_alert",
        urgency: "now",
        content: "Meeting conflict alert: Overlap at 14:00",
      });

      expect(res.fired).toBe(true);
      expect(res.channel).toBe("line");
      expect(linePush).toHaveBeenCalledWith("line-user-1", expect.any(Array));
      expect(addTeamMessage).not.toHaveBeenCalled();
    });

    it("delivers to app chat when user last replied in app", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "conflict_alert" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-ca",
        projectId: "p1",
        name: "conflict_alert",
        kind: "condition",
        config: {},
        enabled: true,
      } as never);
      vi.mocked(prisma.triggerExecutionLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.triggerExecutionLog.count).mockResolvedValue(0);

      // User last replied in web app
      vi.mocked(prisma.messageChannel.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.teamMessage.findFirst).mockResolvedValue({
        createdAt: new Date("2026-10-04T15:00:00Z"),
      } as never);
      vi.mocked(prisma.teamThread.findFirst).mockResolvedValue({ id: "thread-1" } as never);

      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "conflict_alert",
        urgency: "now",
        content: "Meeting conflict",
      });

      expect(res.fired).toBe(true);
      expect(res.channel).toBe("app");
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "p1",
          threadId: "thread-1",
          content: "Meeting conflict",
        }),
      );
      expect(linePush).not.toHaveBeenCalled();
    });

    it("deduplicates triggers to survive restarts and prevent double-firing", async () => {
      vi.mocked(prisma.triggerRule.findMany).mockResolvedValue([{ name: "morning_brief" }] as never);
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r-mb",
        projectId: "p1",
        name: "morning_brief",
        kind: "time",
        config: {},
        enabled: true,
      } as never);

      // Already fired today
      vi.mocked(prisma.triggerExecutionLog.findUnique).mockResolvedValue({
        id: "log-prev",
        decision: "fired",
      } as never);

      const res = await evaluateAndFireTrigger({
        projectId: "p1",
        organizationId: "org-1",
        userId: "u1",
        ruleName: "morning_brief",
        urgency: "today",
        content: "Morning brief",
      });

      expect(res.fired).toBe(false);
      expect(res.decision).toBe("suppressed");
      expect(res.reason).toContain("already fired");
    });
  });

  describe("auditability: why did you / why didn't you message me", () => {
    it("answers why it messaged", async () => {
      vi.mocked(prisma.triggerExecutionLog.findFirst).mockResolvedValue({
        id: "log-1",
        ruleName: "conflict_alert",
        reason: "Fired: now alert via line.",
        channel: "line",
      } as never);

      const explanation = await whyDidYouMessage("p1");
      expect(explanation).toContain("conflict_alert");
      expect(explanation).toContain("channel line");
    });

    it("answers why it did not message", async () => {
      vi.mocked(prisma.triggerExecutionLog.findFirst).mockResolvedValue({
        id: "log-2",
        reason: "Suppressed: within quiet hours (22:00 to 07:00).",
      } as never);

      const explanation = await whyDidntYouMessage("p1");
      expect(explanation).toContain("quiet hours");
    });
  });

  describe("learning and feedback", () => {
    it("offers reduction after repeated dismissals", async () => {
      vi.mocked(prisma.triggerRule.findUnique).mockResolvedValue({
        id: "r1",
        feedback: { dismissedCount: 2, ignoredCount: 0 },
      } as never);
      vi.mocked(prisma.triggerRule.update).mockResolvedValue({} as never);

      const res = await recordFeedback("p1", "morning_brief", "dismissed");
      expect(res.offerReduction).toBe(true);
      expect(res.message).toContain("turn them down");
    });
  });
});
