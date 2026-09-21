/**
 * Database-backed checks for invitations, roles and plan limits. Needs
 * DATABASE_URL and a VAULT_KEY; no model key.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

process.env.VAULT_KEY ??= randomBytes(32).toString("base64");
process.env.ENFORCE_PLAN_LIMITS = "true";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let ownerId: string;
let organizationId: string;
let projectId: string;

beforeAll(async () => {
  const owner = await prisma.user.create({
    data: { email: `owner-${stamp}@example.com`, passwordHash: "x", name: "Owner" },
  });
  ownerId = owner.id;
  const org = await prisma.organization.create({
    data: {
      name: `P4 org ${stamp}`,
      slug: `p4-${stamp}`,
      memberships: { create: { userId: owner.id, role: "owner" } },
      projects: { create: { name: "P4", slug: `p4-project-${stamp}` } },
    },
    include: { projects: true },
  });
  organizationId = org.id;
  projectId = org.projects[0]!.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@example.com` } } });
  await prisma.$disconnect();
});

describe("invitations", () => {
  it("creates, accepts for the invited address only, and closes", async () => {
    const { createInvitation, acceptInvitation, findOpenInvitation, InviteMismatch } = await import("@/lib/invites");
    const invitation = await createInvitation({
      organizationId,
      email: `Teammate-${stamp}@Example.com`,
      role: "admin",
      invitedById: ownerId,
    });
    expect(invitation.email).toBe(`teammate-${stamp}@example.com`);
    expect(await findOpenInvitation(invitation.token)).not.toBeNull();

    const stranger = await prisma.user.create({
      data: { email: `stranger-${stamp}@example.com`, passwordHash: "x" },
    });
    await expect(acceptInvitation(invitation.token, stranger)).rejects.toBeInstanceOf(InviteMismatch);

    const teammate = await prisma.user.create({
      data: { email: `teammate-${stamp}@example.com`, passwordHash: "x" },
    });
    const accepted = await acceptInvitation(invitation.token, teammate);
    expect(accepted?.id).toBe(invitation.id);
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: teammate.id, organizationId } },
    });
    expect(membership?.role).toBe("admin");
    // Single use.
    expect(await findOpenInvitation(invitation.token)).toBeNull();
  });

  it("re-inviting an address replaces the pending invitation", async () => {
    const { createInvitation, findOpenInvitation } = await import("@/lib/invites");
    const first = await createInvitation({ organizationId, email: `again-${stamp}@example.com`, role: "member", invitedById: ownerId });
    const second = await createInvitation({ organizationId, email: `again-${stamp}@example.com`, role: "member", invitedById: ownerId });
    expect(await findOpenInvitation(first.token)).toBeNull();
    expect(await findOpenInvitation(second.token)).not.toBeNull();
  });
});

describe("roles", () => {
  it("ranks owner > admin > member and refuses below the bar", async () => {
    const { requireRole, roleAtLeast, Forbidden } = await import("@/lib/organizations");
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast(null, "member")).toBe(false);
    await expect(requireRole(ownerId, organizationId, "owner")).resolves.toBe("owner");
    const teammate = await prisma.user.findFirstOrThrow({ where: { email: `teammate-${stamp}@example.com` } });
    await expect(requireRole(teammate.id, organizationId, "owner")).rejects.toBeInstanceOf(Forbidden);
    await expect(requireRole(teammate.id, organizationId, "admin")).resolves.toBe("admin");
  });
});

describe("plan limits", () => {
  it("the free plan allows one published agent and refuses a second", async () => {
    const { canPublishAgent } = await import("@/lib/billing/limits");
    const a = await prisma.agent.create({
      data: { projectId, name: "A", jobTitle: "x", personality: "x", responsibilities: [], allowedTools: [], status: "published" },
    });
    const b = await prisma.agent.create({
      data: { projectId, name: "B", jobTitle: "x", personality: "x", responsibilities: [], allowedTools: [] },
    });
    expect((await canPublishAgent(organizationId, a.id)).allowed).toBe(true); // already live
    const refused = await canPublishAgent(organizationId, b.id);
    expect(refused.allowed).toBe(false);
    expect(refused.reason).toMatch(/Free plan allows 1 published agent/);

    await prisma.organization.update({ where: { id: organizationId }, data: { plan: "starter" } });
    expect((await canPublishAgent(organizationId, b.id)).allowed).toBe(true);
    await prisma.organization.update({ where: { id: organizationId }, data: { plan: "free" } });
  });

  it("refuses runs past the monthly quota and the hourly rate", async () => {
    const { canStartRun } = await import("@/lib/billing/limits");
    const { PLANS } = await import("@/lib/billing/plans");
    const agent = await prisma.agent.findFirstOrThrow({ where: { projectId } });
    expect((await canStartRun(organizationId)).allowed).toBe(true);

    // Fill the free plan's hourly rate.
    await prisma.actionItem.createMany({
      data: Array.from({ length: PLANS.free.limits.runsPerHour }, () => ({
        organizationId,
        agentId: agent.id,
        type: "scope_run",
        trigger: "manual",
        payload: {},
        status: "done",
      })),
    });
    const rate = await canStartRun(organizationId);
    expect(rate.allowed).toBe(false);
    expect(rate.reason).toMatch(/last hour/);

    // Pretend the model budget is spent.
    const { usagePeriod } = await import("@/lib/usage");
    await prisma.usageCounter.create({
      data: {
        organizationId,
        period: usagePeriod(),
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        agentId: agent.id,
        inputTokens: 5_000_000,
        outputTokens: 0,
        calls: 1,
      },
    });
    const budget = await canStartRun(organizationId);
    expect(budget.allowed).toBe(false);
    expect(budget.reason).toMatch(/model budget/);
  });
});

describe("integration secrets", () => {
  it("are sealed at rest and opened only on use, and legacy plaintext rows migrate themselves", async () => {
    const { findIntegration, splitIntegrationInput } = await import("@/lib/work/integrations");
    const split = splitIntegrationInput({ type: "webhook", url: "https://hooks.example/abc", secret: "shh" });
    expect(split.config).toEqual({ host: "hooks.example", signed: "true" });
    expect(split.secret).not.toContain("hooks.example");

    await prisma.integration.create({
      data: { organizationId, type: "webhook", name: "sealed", config: split.config, secret: split.secret },
    });
    const opened = await findIntegration<{ url: string; secret: string }>(organizationId, "webhook");
    expect(opened?.config).toEqual({ url: "https://hooks.example/abc", secret: "shh" });

    // A row from before the vault: plaintext in config, no secret column.
    await prisma.integration.deleteMany({ where: { organizationId } });
    const legacy = await prisma.integration.create({
      data: { organizationId, type: "email", name: "legacy", config: { provider: "resend", from: "a@b.c", apiKey: "re_old" } },
    });
    const migrated = await findIntegration<{ apiKey: string; from: string }>(organizationId, "email");
    expect(migrated?.config.apiKey).toBe("re_old");
    const row = await prisma.integration.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(row.secret).toBeTruthy();
    expect(JSON.stringify(row.config)).not.toContain("re_old");
  });
});
