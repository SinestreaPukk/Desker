import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkSensitiveInformation, areContradictory, extractTopic } from "@/lib/memory/hygiene";

// Mock prisma for store operations
vi.mock("@/lib/platform/db", () => ({
  prisma: {
    personRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    memoryRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/platform/db";
import { saveMemory, forgetMemory, recallMemories, resolvePersonRecord } from "@/lib/memory/store";

describe("memory hygiene", () => {
  it("refuses to store passwords and credentials", () => {
    const result1 = checkSensitiveInformation("My password is secret123");
    expect(result1.forbidden).toBe(true);
    expect(result1.reason).toContain("passwords");

    const result2 = checkSensitiveInformation("ATM pin is 1234");
    expect(result2.forbidden).toBe(true);
  });

  it("refuses to store credit card numbers", () => {
    const result = checkSensitiveInformation("Pay with card 4111 2222 3333 4444");
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain("card numbers");
  });

  it("refuses to store government IDs", () => {
    const resultThai = checkSensitiveInformation("My citizen ID is 1-1234-12345-12-1");
    expect(resultThai.forbidden).toBe(true);
    expect(resultThai.reason).toContain("government");

    const resultSsn = checkSensitiveInformation("My ssn is 123-45-6789");
    expect(resultSsn.forbidden).toBe(true);
  });

  it("permits safe preferences and facts", () => {
    const result = checkSensitiveInformation("Prefers oat milk in coffee and no meetings before 10 AM");
    expect(result.forbidden).toBe(false);
  });
});

describe("contradiction detection", () => {
  it("detects address topic and contradiction", () => {
    expect(extractTopic("Lives in Thong Lo, Bangkok")).toBe("address");
    expect(extractTopic("Moved to Ari, Bangkok")).toBe("address");
    expect(areContradictory("Lives in Thong Lo, Bangkok", "Moved to Ari, Bangkok")).toBe(true);
  });

  it("does not flag unrelated facts as contradictory", () => {
    expect(areContradictory("Lives in Thong Lo, Bangkok", "Prefers window seat")).toBe(false);
  });
});

describe("memory store operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a stated fact immediately without requiring approval", async () => {
    vi.mocked(prisma.memoryRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.memoryRecord.create).mockResolvedValue({
      id: "mem-1",
      projectId: "p1",
      fact: "No meetings before 10 AM",
      kind: "preference",
      source: "user",
      status: "confirmed",
      confidence: 1.0,
      personId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    });

    const res = await saveMemory({
      projectId: "p1",
      fact: "No meetings before 10 AM",
      kind: "preference",
    });

    expect(res.needsConfirmation).toBe(false);
    expect(res.message).toBe("Noted: No meetings before 10 AM");
    expect(prisma.memoryRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "confirmed",
          source: "user",
        }),
      }),
    );
  });

  it("marks inferred facts as pending confirmation", async () => {
    vi.mocked(prisma.memoryRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.memoryRecord.create).mockResolvedValue({
      id: "mem-2",
      projectId: "p1",
      fact: "Prefers morning flights",
      kind: "preference",
      source: "inferred",
      status: "pending_confirmation",
      confidence: 0.8,
      personId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    });

    const res = await saveMemory({
      projectId: "p1",
      fact: "Prefers morning flights",
      kind: "preference",
      inferred: true,
      confidence: 0.8,
    });

    expect(res.needsConfirmation).toBe(true);
    expect(res.message).toContain("Should I remember this?");
    expect(prisma.memoryRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending_confirmation",
          source: "inferred",
        }),
      }),
    );
  });

  it("updates existing fact in place when contradiction detected", async () => {
    vi.mocked(prisma.memoryRecord.findMany).mockResolvedValue([
      {
        id: "mem-old-addr",
        projectId: "p1",
        fact: "Lives in Thong Lo, Bangkok",
        kind: "fact",
        source: "user",
        status: "confirmed",
        confidence: 1.0,
        personId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      },
    ]);
    vi.mocked(prisma.memoryRecord.update).mockResolvedValue({
      id: "mem-old-addr",
      projectId: "p1",
      fact: "Moved to Ari, Bangkok",
      kind: "fact",
      source: "user",
      status: "confirmed",
      confidence: 1.0,
      personId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    });

    const res = await saveMemory({
      projectId: "p1",
      fact: "Moved to Ari, Bangkok",
      kind: "fact",
    });

    expect(prisma.memoryRecord.create).not.toHaveBeenCalled();
    expect(prisma.memoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mem-old-addr" },
        data: expect.objectContaining({
          fact: "Moved to Ari, Bangkok",
        }),
      }),
    );
    expect(res.message).toBe("Noted: Moved to Ari, Bangkok");
  });

  it("resolves person record for 'my mom'", async () => {
    vi.mocked(prisma.personRecord.findUnique).mockResolvedValue({
      id: "person-mom",
      projectId: "p1",
      name: "Mom",
      relationship: "mother",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const personId = await resolvePersonRecord("p1", undefined, undefined, "my mom likes tea");
    expect(personId).toBe("person-mom");
  });

  it("forgets memory with 'forget that'", async () => {
    vi.mocked(prisma.memoryRecord.findFirst).mockResolvedValue({
      id: "mem-latest",
      projectId: "p1",
      fact: "Likes black coffee",
      kind: "preference",
      source: "user",
      status: "confirmed",
      confidence: 1.0,
      personId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
    });
    vi.mocked(prisma.memoryRecord.delete).mockResolvedValue({} as never);

    const res = await forgetMemory({ projectId: "p1", query: "that" });
    expect(res.deleted).toBe(1);
    expect(res.message).toBe('Forgotten: "Likes black coffee"');
    expect(prisma.memoryRecord.delete).toHaveBeenCalledWith({ where: { id: "mem-latest" } });
  });

  it("recalls relevant memories by query", async () => {
    vi.mocked(prisma.memoryRecord.findMany).mockResolvedValue([
      {
        id: "mem-1",
        projectId: "p1",
        fact: "Coffee preference: oat milk latte",
        kind: "preference",
        source: "user",
        status: "confirmed",
        personId: null,
        person: null,
        createdAt: new Date(),
        lastUsedAt: null,
      } as never,
    ]);

    const results = await recallMemories({
      projectId: "p1",
      query: "coffee",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.fact).toContain("oat milk latte");
  });
});
