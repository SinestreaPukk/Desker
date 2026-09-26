import { expect, test } from "@playwright/test";
import { currentProjectSlug } from "./helpers";

/**
 * The Integrations library: grouped by what each connector is for, filterable
 * by role, honest about what this server can connect, and the webhook pattern
 * still working for publishing - now named for a platform.
 */
test("the library groups connectors, filters by role, and is honest about setup", async ({ page }) => {
  const project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/integrations`);

  for (const heading of ["Calendar & messaging", "Code & issues", "Publishing & email", "Customers & sales", "People & HR"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  // Every card says what it can and cannot do.
  const calendar = page.locator("#google_calendar");
  await expect(calendar.getByText("It can", { exact: true })).toBeVisible();
  await expect(calendar.getByText("Read your email or files")).toBeVisible();
  // The e2e server has no Google credentials, and says so instead of offering a broken button.
  await expect(calendar.getByText("Not set up on this server")).toBeVisible();
  await expect(page.locator("#hubspot").getByText("Coming soon")).toBeVisible();

  // Filtering to the developer role keeps GitHub and drops the calendar.
  await page.getByRole("button", { name: "Developer Support Engineer" }).click();
  await expect(page.locator("#github")).toBeVisible();
  await expect(page.locator("#google_calendar")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
});

test("a publishing webhook can be named for a platform", async ({ page }) => {
  const project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/integrations`);
  await page.locator("#webhook").getByRole("button", { name: /Set up|Add another/ }).click();

  await page.getByLabel("Name").fill(`LinkedIn via Zapier ${Date.now()}`);
  await page.getByLabel("Platform").click();
  await page.getByRole("option", { name: "LinkedIn" }).click();
  await page.getByLabel("Where to send posts").fill("https://hooks.example.com/catch/123");
  await page.getByRole("button", { name: "Connect it" }).click();

  await expect(page.getByText("LinkedIn · hooks.example.com").first()).toBeVisible({ timeout: 20_000 });
});
