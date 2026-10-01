/**
 * "Where to?" after signing in: a business space and a personal space are
 * both offered, business first, each pointing at its own front door (a new
 * space's first run, an established one's Roster).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { spaceChoices } from "@/lib/space-entry";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let userId: string;
const orgIds: string[] = [];

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `choose-${stamp}@example.test`, passwordHash: "x" } })).id;
  for (const kind of ["personal", "business"] as const) {
    const org = await prisma.organization.create({
      data: {
        name: kind === "business" ? `Acme ${stamp}` : `Sam's space ${stamp}`,
        slug: `${kind}-${stamp}`,
        kind,
        memberships: { create: { userId, role: "owner" } },
        projects: { create: { name: "Main", slug: `${kind}-${stamp}` } },
      },
      include: { projects: true },
    });
    orgIds.push(org.id);
    // The business has someone on its roster already; the personal space is brand new.
    if (kind === "business") {
      await prisma.agent.create({
        data: { projectId: org.projects[0]!.id, name: "Mia", jobTitle: "Support", personality: "Plain.", responsibilities: [], allowedTools: [] },
      });
    }
  }
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("where to after signing in", () => {
  it("offers the business and the personal space, business first, each to its own front door", async () => {
    const choices = await spaceChoices(userId);
    expect(choices.map((choice) => choice.kind)).toEqual(["business", "personal"]);
    expect(choices[0]).toMatchObject({ name: `Acme ${stamp}`, href: `/p/business-${stamp}/roster` });
    expect(choices[1]).toMatchObject({ name: `Sam's space ${stamp}`, href: `/p/personal-${stamp}/start` });
  });
});
