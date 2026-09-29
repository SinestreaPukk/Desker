/**
 * Sign-up asks who someone is: first and last name, a unique username, the
 * business they are founding (if any), and what Desker is for: a business, a
 * personal space, or both. Needs DATABASE_URL.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
// The sign-in library does not load under the test runner; only hashing is needed.
vi.mock("@/lib/auth", () => ({ hashPassword: async (password: string) => `test-hash:${password.length}` }));

import { POST as signup } from "@/app/api/signup/route";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);

const body = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Alex",
  lastName: "Chen",
  username: `alex-${stamp}`,
  organization: "Chen Studio",
  useType: "business",
  email: `alex-${stamp}@example.com`,
  password: "long-enough-pass",
  acceptTerms: true,
  ...overrides,
});

const post = (payload: unknown) =>
  signup(
    new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${stamp.length}.1` },
      body: JSON.stringify(payload),
    }),
  );

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@example.com` } }, select: { id: true } });
  const orgs = await prisma.membership.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { organizationId: true } });
  await prisma.organization.deleteMany({ where: { id: { in: orgs.map((o) => o.organizationId) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.$disconnect();
});

describe("sign-up", () => {
  it("records the profile and names the organisation as given", async () => {
    const response = await post(body({ username: `Alex-${stamp}` }));
    expect(response.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `alex-${stamp}@example.com` },
      include: { memberships: { include: { organization: true } } },
    });
    expect(user).toMatchObject({
      name: "Alex Chen",
      firstName: "Alex",
      lastName: "Chen",
      username: `alex-${stamp}`,
      useType: "business",
    });
    expect(user.memberships[0]!.organization).toMatchObject({ name: "Chen Studio", kind: "business" });
  });

  it("founds a private personal space without asking for a business name", async () => {
    const response = await post(
      body({ email: `p-${stamp}@example.com`, username: `p-${stamp}`, organization: undefined, useType: "personal" }),
    );
    expect(response.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `p-${stamp}@example.com` },
      include: { memberships: { include: { organization: { include: { projects: true } } } } },
    });
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0]!.organization).toMatchObject({ name: "Alex's personal space", kind: "personal" });
    expect(user.memberships[0]!.organization.projects).toHaveLength(1);
  });

  it("founds both spaces for someone who wants both", async () => {
    const response = await post(body({ email: `m-${stamp}@example.com`, username: `m-${stamp}`, useType: "mixed" }));
    expect(response.status).toBe(200);
    const memberships = await prisma.membership.findMany({
      where: { user: { email: `m-${stamp}@example.com` } },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    expect(memberships.map((m) => m.organization.kind)).toEqual(["business", "personal"]);
  });

  it("asks what Desker is for, and a business's name when founding one", async () => {
    const response = await post(body({ email: `b-${stamp}@example.com`, username: `b-${stamp}`, organization: "", useType: "hobby" }));
    expect(response.status).toBe(422);
    const { details } = (await response.json()) as { details: { fieldErrors: Record<string, string[]> } };
    expect(Object.keys(details.fieldErrors)).toEqual(expect.arrayContaining(["useType"]));

    const noName = await post(body({ email: `d-${stamp}@example.com`, username: `d-${stamp}`, organization: "" }));
    expect(noName.status).toBe(422);
  });

  it("refuses a username someone already has", async () => {
    const response = await post(body({ email: `c-${stamp}@example.com` }));
    expect(response.status).toBe(409);
    const { details } = (await response.json()) as { details: { fieldErrors: Record<string, string[]> } };
    expect(details.fieldErrors.username?.[0]).toMatch(/taken/);
  });
});
