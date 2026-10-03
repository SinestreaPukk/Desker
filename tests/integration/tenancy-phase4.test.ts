/**
 * Database-backed checks for roles and plan limits. Needs
 * DATABASE_URL and a VAULT_KEY; no model key.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

process.env.VAULT_KEY ??= randomBytes(32).toString("base64");

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let ownerId: string;
let organizationId: string;

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
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@example.com` } } });
  await prisma.$disconnect();
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
