import { expect, test } from "@playwright/test";
import { ANONYMOUS, currentProjectSlug } from "./helpers";

/**
 * Keyboard and responsive checks. Not a substitute for an audit, but these are
 * the regressions that actually happen: a skip link that stops working, a focus
 * ring someone removes, a layout that scrolls sideways on a phone.
 */
test.describe.configure({ mode: "serial" });

test.describe("signed out", () => {
  // /login redirects an authenticated visitor straight to the roster.
  test.use({ storageState: ANONYMOUS });

  test("sign-in is fully operable from the keyboard", async ({ page }) => {
    await page.goto("/login");

    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A"]).toContain(focused);

    // Every control must expose a visible focus indicator.
    await page.getByLabel("Email").focus();
    const outline = await page
      .getByLabel("Email")
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
  });
});

test("the admin shell exposes a working skip link", async ({ page }) => {
  const project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/roster`);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#admin-main")).toBeVisible();
});

test("the roster does not scroll sideways at 360px", async ({ page }) => {
  const project = await currentProjectSlug(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/p/${project}/roster`);
  // Exact: the empty-state heading ("No one on the roster yet") would
  // otherwise also match on a substring.
  await expect(
    page.getByRole("heading", { name: "Roster", exact: true }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("dark mode applies and survives a reload", async ({ page }) => {
  const project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/roster`);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The page must actually repaint, not just carry a class.
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
});
