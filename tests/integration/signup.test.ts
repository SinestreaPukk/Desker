/**
 * Sign-up asks who someone is: first and last name and a unique username, and
 * founds their private personal space. Needs DATABASE_URL.
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
      body: JSON.stringify({ startedAt: Date.now() - 5000, ...(payload as object) }),
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
  it("records the profile and founds a private personal space", async () => {
    const response = await post(body({ username: `Alex-${stamp}` }));
    expect(response.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `alex-${stamp}@example.com` },
      include: { memberships: { include: { organization: { include: { projects: true } } } } },
    });
    expect(user).toMatchObject({ name: "Alex Chen", firstName: "Alex", lastName: "Chen", username: `alex-${stamp}` });
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0]!.organization).toMatchObject({ name: "Alex's personal space" });
    expect(user.memberships[0]!.organization.projects).toHaveLength(1);
  });

  it("no longer asks for a business or a use type", async () => {
    const response = await post(body({ email: `b-${stamp}@example.com`, username: `b-${stamp}`, useType: "business" }));
    expect(response.status).toBe(422);
  });

  it("refuses a username someone already has", async () => {
    const response = await post(body({ email: `c-${stamp}@example.com` }));
    expect(response.status).toBe(409);
    const { details } = (await response.json()) as { details: { fieldErrors: Record<string, string[]> } };
    expect(details.fieldErrors.username?.[0]).toMatch(/taken/);
  });

  it("refuses a sign-up sent faster than a person could fill the form in", async () => {
    const response = await signup(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${stamp.length}.1` },
        body: JSON.stringify({ ...(body({ email: `bot-${stamp}@example.com`, username: `bot${stamp}` }) as object), startedAt: Date.now() - 100 }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: `bot-${stamp}@example.com` } })).toBeNull();
  });
});
