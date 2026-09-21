import { expect, type Page } from "@playwright/test";

export const hasModelKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

/** The shared admin the setup project signs in as. */
export const ADMIN = {
  email: "e2e-admin@example.com",
  password: "e2e-password-123",
  name: "E2E Admin",
  acceptTerms: true,
};

export const ADMIN_STATE = "tests/e2e/.auth/admin.json";

/** An anonymous context, for specs that must not start signed in. */
export const ANONYMOUS = { cookies: [], origins: [] };

/** A distinct admin, for specs that exercise signup itself. */
export function uniqueAdmin() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { email: `e2e-${stamp}@example.com`, password: "e2e-password-123" };
}

/** The project every spec works inside, resolved once after sign-in. */
export async function currentProjectSlug(page: Page): Promise<string> {
  await page.goto("/");
  // "/" forwards to the roster, or to the wizard when the project is still
  // empty; either way the project slug is the second segment.
  await page.waitForURL(/\/p\/[^/]+\//, { timeout: 30_000 });
  return page.url().match(/\/p\/([^/]+)\//)![1]!;
}

export async function signUp(
  page: Page,
  admin: { email: string; password: string },
) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  // Signs in and lands inside a project. Which page depends on whether the
  // workspace already has agents - the wizard when empty, the roster when not -
  // so asserting on either one alone makes the test order-dependent.
  await expect(page).toHaveURL(/\/p\/[^/]+\//, { timeout: 30_000 });
}
