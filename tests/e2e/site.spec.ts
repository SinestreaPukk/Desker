import { expect, test } from "@playwright/test";
import { ANONYMOUS, signUp, uniqueAdmin } from "./helpers";
import landing from "../../content/landing.json";
import templates from "../../content/templates.json";

test.use({ storageState: ANONYMOUS });

/** The public site: what a stranger sees, driven by the content files. */
test("the landing page renders the content file and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(landing.hero.headline);
  await expect(page.getByRole("link", { name: landing.hero.primaryCta.label }).first()).toHaveAttribute("href", "/signup");
  await expect(page).toHaveTitle(/Desker/);
  const og = page.locator('meta[property="og:title"]');
  await expect(og).toHaveAttribute("content", /Desker/);
});

test.describe("the landing page without JavaScript", () => {
  test.use({ storageState: ANONYMOUS, javaScriptEnabled: false });

  test("still shows every section, fully visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const step of landing.howItWorks.steps) {
      await expect(page.getByRole("heading", { name: step.title })).toBeVisible();
    }
    for (const card of landing.bento.cards) {
      await expect(page.getByRole("heading", { name: card.title })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: landing.cta.heading })).toBeVisible();
    // Motion's initial states are applied only after the library loads; the
    // HTML a crawler reads must never hide anything.
    const hidden = await page.locator('[style*="opacity: 0"], [style*="opacity:0"]').count();
    expect(hidden).toBe(0);
    // The stats render their final numbers, not the zero a count-up starts from.
    for (const stat of landing.stats) {
      await expect(page.getByText(`${stat.value}${stat.suffix}`, { exact: true })).toBeVisible();
    }
  });
});

test("the animation library is not on the landing page's critical path", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await page.goto("/", { waitUntil: "load" });
  const critical = [...scripts];

  // Motion's chunk is identified by what it contains, not by its hashed name.
  const usesMotion = async (url: string) => (await (await page.request.get(url)).text()).includes("whileInView");
  for (const url of critical) expect(await usesMotion(url), `${url} loads Motion before the page is interactive`).toBe(false);

  // It arrives afterwards, once the page is interactive.
  await expect
    .poll(async () => {
      const late = scripts.filter((url) => !critical.includes(url));
      for (const url of late) if (await usesMotion(url)) return true;
      return false;
    }, { timeout: 10_000 })
    .toBe(true);
});

test("every public page carries a preview image for shared links", async ({ page, request }) => {
  for (const path of ["/", "/showcase", "/contact"]) {
    await page.goto(path);
    // A page that redefines openGraph loses the root image unless it says so.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  }
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
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

test.describe("a role chosen on the showcase", () => {
  test.use({ storageState: ANONYMOUS });

  test("rides through signup into the hire wizard", async ({ page }) => {
    await page.goto("/showcase");
    await page.locator("#researcher").getByRole("link", { name: "Hire this role" }).click();
    await expect(page).toHaveURL(/\/signup\?template=researcher/);

    await signUp(page, uniqueAdmin(), page.url());
    await expect(page).toHaveURL(/\/agents\/new\?template=researcher/);
    // The wizard opens past the picker with the role's job filled in.
    await expect(page.getByLabel("Job title")).toHaveValue(/Research/);
  });
});
