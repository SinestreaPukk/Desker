import { expect, test } from "@playwright/test";
import { ANONYMOUS } from "./helpers";
import landing from "../../content/landing.json";
import templates from "../../content/templates.json";

test.use({ storageState: ANONYMOUS });

/** The public site: what a stranger sees, driven by the content files. */
test("the landing page renders the content file and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(landing.hero.headline);
  await expect(page.getByRole("link", { name: landing.hero.primaryCta.label })).toHaveAttribute("href", "/signup");
  await expect(page).toHaveTitle(/Desker/);
  const og = page.locator('meta[property="og:title"]');
  await expect(og).toHaveAttribute("content", /Desker/);
});

test("the showcase lists every template with its example", async ({ page }) => {
  await page.goto("/showcase");
  for (const t of templates.templates) {
    await expect(page.getByRole("heading", { name: t.name, exact: true })).toBeVisible();
    await expect(page.getByText(t.example.prompt)).toBeVisible();
  }
});

test("the contact form accepts a message", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel(/Your name/).fill("Playwright");
  await page.getByLabel(/^Email/).fill("playwright@example.com");
  await page.getByLabel(/How can we help/).fill("Checking that the contact form reaches you end to end.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText(/we have your message/);
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/showcase");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /p/");
});
