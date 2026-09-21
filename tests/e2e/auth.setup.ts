import { expect, test as setup } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, ADMIN_STATE } from "./helpers";

/**
 * Authenticates once and saves the session, so every spec starts signed in.
 *
 * Playwright gives each test a fresh browser context, so without this each
 * spec would have to sign in again - and any spec that forgot would silently
 * be testing the login page instead of the page it names.
 */
setup("authenticate", async ({ page, request }) => {
  // Idempotent: a second run against an existing database returns 409, which is
  // fine - the account just already exists. Anything else means the database is
  // not actually reachable or migrated, and every later spec would fail with a
  // misleading "wrong password" instead.
  const response = await request.post("/api/signup", { data: ADMIN });
  expect(
    [200, 201, 409],
    `signup returned ${response.status()}: ${await response.text()}`,
  ).toContain(response.status());

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
    // The landing route depends on whether the project already has agents: an
  // empty one opens the wizard, a populated one the roster. Both mean signed in.
  await expect(page).toHaveURL(/\/p\/[^/]+\//, { timeout: 30_000 });

  await page.context().storageState({ path: ADMIN_STATE });

  // Plan limits are enforced in the e2e run (the team spec proves them on a
  // fresh organisation). The shared organisation accumulates published agents
  // across runs, so it gets the roomiest plan straight in the database - the
  // same thing the Stripe webhook would write.
  const prisma = new PrismaClient();
  try {
    await prisma.organization.updateMany({
      where: { memberships: { some: { user: { email: ADMIN.email } } } },
      data: { plan: "growth" },
    });
    // Every run publishes agents; over enough runs the accumulated ones would
    // hit even that plan's cap. Each run starts with all of them unpublished.
    await prisma.agent.updateMany({
      where: { project: { organization: { memberships: { some: { user: { email: ADMIN.email } } } } } },
      data: { status: "draft" },
    });
  } finally {
    await prisma.$disconnect();
  }
});
