import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the modules that hit the DB
vi.mock("@/lib/platform/db", () => ({
  prisma: {
    memoryRecord: { findMany: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    commitment: { findMany: vi.fn(), update: vi.fn() },
    triggerRule: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    triggerExecutionLog: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/agents/team", () => ({
  addTeamMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
}));

vi.mock("@/lib/memory/store", () => ({
  listMemories: vi.fn(),
  recallMemories: vi.fn(),
  forgetMemory: vi.fn(),
}));

vi.mock("@/lib/commitments/store", () => ({
  listCommitments: vi.fn(),
}));

vi.mock("@/lib/triggers/engine", () => ({
  updateTriggerRule: vi.fn(),
  whyDidYouMessage: vi.fn(),
  whyDidntYouMessage: vi.fn(),
}));

import { handleAssistantCommand } from "@/lib/life/assistant-commands";
import { addTeamMessage } from "@/lib/agents/team";
import { listMemories, recallMemories, forgetMemory } from "@/lib/memory/store";
import { listCommitments } from "@/lib/commitments/store";
import { updateTriggerRule, whyDidYouMessage, whyDidntYouMessage } from "@/lib/triggers/engine";

const mockSpeaker = {
  id: "agent-1",
  name: "Desker",
  templateId: null,
  jobTitle: "Personal Assistant",
  department: null,
  personality: "Helpful",
  responsibilities: [],
  modelProvider: "anthropic",
  model: "claude-3-5-sonnet",
  scopeOfWork: null,
};

const mockCtx = {
  projectId: "proj-1",
  organizationId: "org-1",
  threadId: "thread-1",
  userId: "user-1",
};

describe("Assistant Core Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Memory commands", () => {
    it("handles 'what do you know about me'", async () => {
      vi.mocked(listMemories).mockResolvedValue([
        { id: "m1", projectId: "proj-1", fact: "No meetings before 10 AM", status: "confirmed" } as never,
        { id: "m2", projectId: "proj-1", fact: "Prefers oat milk", status: "confirmed" } as never,
      ]);

      const handled = await handleAssistantCommand("what do you know about me?", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("No meetings before 10 AM"),
        }),
      );
    });

    it("handles 'what do you know about my mom'", async () => {
      vi.mocked(recallMemories).mockResolvedValue([
        { id: "m3", projectId: "proj-1", fact: "Mom's birthday is June 12" } as never,
      ]);

      const handled = await handleAssistantCommand("what do you know about my mom", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(recallMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          personName: "mom",
        }),
      );
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Mom's birthday is June 12"),
        }),
      );
    });

    it("handles 'forget that'", async () => {
      vi.mocked(forgetMemory).mockResolvedValue({
        deleted: 1,
        message: 'Forgotten: "No meetings before 10 AM"',
      });

      const handled = await handleAssistantCommand("forget that", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(forgetMemory).toHaveBeenCalledWith({ projectId: "proj-1", query: "that" });
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Forgotten: "No meetings before 10 AM"',
        }),
      );
    });
  });

  describe("Commitments commands", () => {
    it("handles 'what am I waiting on?'", async () => {
      vi.mocked(listCommitments).mockResolvedValue([
        {
          id: "c1",
          projectId: "proj-1",
          type: "waiting_on",
          ownerRole: "other",
          ownerName: "Nok",
          outcome: "send contract review",
          dueAt: "2026-10-15T00:00:00.000Z",
          status: "open",
        } as never,
      ]);

      const handled = await handleAssistantCommand("what am I waiting on?", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("waiting on Nok"),
        }),
      );
    });
  });

  describe("Trigger rule commands", () => {
    it("handles 'move my brief to 7:30'", async () => {
      vi.mocked(updateTriggerRule).mockResolvedValue({} as never);

      const handled = await handleAssistantCommand("move my brief to 7:30", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(updateTriggerRule).toHaveBeenCalledWith("proj-1", {
        ruleName: "morning_brief",
        time: "07:30",
      });
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("07:30"),
        }),
      );
    });

    it("handles 'only urgent things at night'", async () => {
      vi.mocked(updateTriggerRule).mockResolvedValue({} as never);

      const handled = await handleAssistantCommand("only urgent things at night", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(updateTriggerRule).toHaveBeenCalledWith("proj-1", {
        ruleName: "morning_brief",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      });
    });

    it("handles 'stop telling me about bills'", async () => {
      vi.mocked(updateTriggerRule).mockResolvedValue({} as never);

      const handled = await handleAssistantCommand("stop telling me about bills", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(updateTriggerRule).toHaveBeenCalledWith("proj-1", {
        ruleName: "due_soon_alert",
        enabled: false,
        addSuppressedTopic: "bills",
      });
    });

    it("handles 'why did you message me'", async () => {
      vi.mocked(whyDidYouMessage).mockResolvedValue("I messaged you because: Morning brief fired.");

      const handled = await handleAssistantCommand("why did you message me", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(whyDidYouMessage).toHaveBeenCalledWith("proj-1");
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Morning brief fired"),
        }),
      );
    });

    it("handles 'why didn't you message me'", async () => {
      vi.mocked(whyDidntYouMessage).mockResolvedValue("Suppressed due to quiet hours.");

      const handled = await handleAssistantCommand("why didn't you message me?", mockCtx, mockSpeaker);
      expect(handled).toBe(true);
      expect(whyDidntYouMessage).toHaveBeenCalledWith("proj-1");
      expect(addTeamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Suppressed due to quiet hours.",
        }),
      );
    });

    it("returns false for regular chat messages", async () => {
      const handled = await handleAssistantCommand("Can I take next Friday off?", mockCtx, mockSpeaker);
      expect(handled).toBe(false);
      expect(addTeamMessage).not.toHaveBeenCalled();
    });
  });
});
