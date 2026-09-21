import { expect, test } from "@playwright/test";
import { ANONYMOUS, currentProjectSlug, signUp, uniqueAdmin } from "./helpers";

/**
 * The stranger's path: an owner invites, the invitee creates an account from
 * the link, and lands inside the owner's organisation - not a new one.
 */
test("an owner invites a teammate who joins from the link", async ({ page, browser }) => {
  const project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/organization`);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();

  const invitee = uniqueAdmin();
  await page.getByLabel("Email", { exact: true }).fill(invitee.email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  const link = await page.locator("code", { hasText: "/invite/" }).first().textContent();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("listitem").filter({ hasText: invitee.email })).toBeVisible();

  // The invitee, signed out, in their own browser context.
  const context = await browser.newContext({ storageState: ANONYMOUS });
  const guest = await context.newPage();
  await guest.goto(new URL(link!).pathname);
  await expect(guest.getByText(/You have been invited as/)).toBeVisible();
  await guest.getByRole("link", { name: "Create an account" }).click();
  await expect(guest.getByLabel("Email")).toHaveValue(invitee.email);
  await guest.getByLabel("Password").fill(invitee.password);
  await guest.getByRole("button", { name: "Create account" }).click();

  // Same project as the owner: the invitee joined, rather than founding an org.
  await expect(guest).toHaveURL(new RegExp(`/p/${project}/`), { timeout: 30_000 });
  await guest.goto(`/p/${project}/organization`);
  // The members list, not the account menu (hidden behind a button on a phone).
  await expect(guest.getByRole("listitem").filter({ hasText: invitee.email })).toBeVisible();
  // A member sees the roster of people but not the invite form.
  await expect(guest.getByRole("button", { name: "Send invitation" })).toHaveCount(0);
  await context.close();

  // The owner's member list now has them, and the invitation is gone.
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: invitee.email }).first()).toBeVisible();
});

test("the free plan stops a second agent from being published", async ({ browser }) => {
  // A brand-new organisation on the free plan, so the count is known.
  const context = await browser.newContext({ storageState: ANONYMOUS });
  const page = await context.newPage();
  await signUp(page, uniqueAdmin());
  const project = page.url().match(/\/p\/([^/]+)\//)![1]!;
  const request = context.request;

  const make = (name: string, status: string) =>
    request.post(`/api/agents?project=${project}`, {
      data: {
        name,
        jobTitle: "Tester",
        personality: "Terse and helpful.",
        responsibilities: ["Test"],
        allowedTools: [],
        status,
      },
    });
  const first = await make("Limit A", "published");
  expect(first.ok(), await first.text()).toBe(true);
  const second = await make("Limit B", "published");
  expect(second.status()).toBe(402);
  expect((await second.json()).error).toMatch(/Free plan allows 1 published agent/);

  const draft = await (await make("Limit C", "draft")).json();
  const promote = await request.patch(`/api/agents/${draft.id}`, { data: { status: "published" } });
  expect(promote.status()).toBe(402);

  // The billing panel says the same thing.
  await page.goto(`/p/${project}/organization`);
  await expect(page.getByText("1 / 1")).toBeVisible();
  await context.close();
});
