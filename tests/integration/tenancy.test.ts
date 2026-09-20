/**
 * Database-backed checks for the tenancy primitives. Needs DATABASE_URL, but
 * no model API key - every assertion is about rows, not replies.
 *
 *   npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { recordTokenUsage, usageForOrganization, usagePeriod } from "@/lib/usage";
import { audit } from "@/lib/audit";
import {
  createOrganizationFor,
  organizationsFor,
  primaryOrganizationFor,
} from "@/lib/organizations";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);

let userId: string;
let organizationId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `tenancy-${stamp}@example.com`, passwordHash: "x", name: "Tenancy Test" },
  });
  userId = user.id;
});

afterAll(async () => {
  // Cascades: organisation -> memberships, counters, audit rows.
  await prisma.organization.deleteMany({ where: { memberships: { some: { userId } } } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("organisations", () => {
  it("a user with no membership gets a personal organisation, once", async () => {
    const first = await primaryOrganizationFor(userId);
    const second = await primaryOrganizationFor(userId);
    expect(first.id).toBe(second.id);
    expect(first.role).toBe("owner");
    organizationId = first.id;

    const all = await organizationsFor(userId);
    expect(all).toHaveLength(1);
  });

  it("a user can own several organisations with distinct slugs", async () => {
    const extra = await createOrganizationFor(userId, "Tenancy Test");
    const all = await organizationsFor(userId);
    expect(all.map((org) => org.id)).toContain(extra.id);
    expect(new Set(all.map((org) => org.slug)).size).toBe(all.length);
  });
});

describe("token usage counter", () => {
  it("increments one bucket per org/period/provider/model/agent", async () => {
    const before = await usageForOrganization(organizationId);
    expect(before.calls).toBe(0);

    await recordTokenUsage({
      organizationId,
      agentId: "agent-a",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 20,
    });
    await recordTokenUsage({
      organizationId,
      agentId: "agent-a",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      inputTokens: 50,
      outputTokens: 5,
    });
    // A different agent lands in its own bucket but the same org total.
    await recordTokenUsage({
      organizationId,
      agentId: null,
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      inputTokens: 1,
      outputTokens: 1,
    });

    const rows = await prisma.usageCounter.findMany({
      where: { organizationId },
      orderBy: { agentId: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.period === usagePeriod())).toBe(true);
    const agentRow = rows.find((row) => row.agentId === "agent-a")!;
    expect(agentRow.calls).toBe(2);
    expect(agentRow.inputTokens).toBe(150);
    expect(agentRow.outputTokens).toBe(25);

    const total = await usageForOrganization(organizationId);
    expect(total).toMatchObject({ calls: 3, inputTokens: 151, outputTokens: 26 });
  });

  it("survives concurrent first writes to a new bucket", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        recordTokenUsage({
          organizationId,
          agentId: "agent-parallel",
          provider: "openai",
          model: "gpt-4o",
          inputTokens: 10,
          outputTokens: 1,
        }),
      ),
    );
    const row = await prisma.usageCounter.findFirst({
      where: { organizationId, agentId: "agent-parallel" },
    });
    expect(row?.calls).toBe(5);
    expect(row?.inputTokens).toBe(50);
  });
});

describe("audit log", () => {
  it("records actor, action, target and metadata", async () => {
    await audit({
      organizationId,
      actorType: "user",
      actorId: userId,
      action: "test.happened",
      targetType: "widget",
      targetId: "w1",
      metadata: { why: "because" },
    });
    const row = await prisma.auditLog.findFirst({
      where: { organizationId, action: "test.happened" },
    });
    expect(row).toMatchObject({
      actorType: "user",
      actorId: userId,
      targetType: "widget",
      targetId: "w1",
      metadata: { why: "because" },
    });
  });
});
