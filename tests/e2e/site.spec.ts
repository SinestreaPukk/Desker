import { expect, test } from "@playwright/test";
import { ANONYMOUS } from "./helpers";

test.use({ storageState: ANONYMOUS });

/** The public site: what a stranger sees. */
test("the landing page is the reconstruction notice with sign-in links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/under reconstruction/);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  await expect(page).toHaveTitle(/Desker/);
});

test("every public page carries a preview image for shared links", async ({ page, request }) => {
  for (const path of ["/", "/contact"]) {
    await page.goto(path);
    // A page that redefines openGraph loses the root image unless it says so.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  }
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
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
  expect(await sitemap.text()).toContain("/guides");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /p/");
});
