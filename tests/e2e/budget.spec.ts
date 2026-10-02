import { expect, test } from "@playwright/test";
import { ANONYMOUS, currentProjectSlug } from "./helpers";

/**
 * The performance budget, measured as a browser experiences it: how much
 * JavaScript each page actually downloads on a cold cache.
 *
 * A budget nobody checks is a wish. These numbers are deliberately loose
 * enough not to fail on a refactor and tight enough to catch the thing that
 * actually goes wrong - a heavy dependency wandering onto a screen that has
 * no use for it. When one of them fails, the fix is to find what got added,
 * not to raise the number.
 *
 * tests/unit/bundle-boundaries.test.ts catches the same class of mistake at
 * the import, which is cheaper; this is the backstop that cannot be fooled.
 */

/** Kilobytes of JavaScript, transferred, per page. */
const BUDGET_KB = {
  /** The landing page alone may pay for the animation library. */
  landing: 380,
  roster: 300,
  needsYou: 300,
};

/**
 * Turning motion off has to save the download, not just the movement - that
 * is the whole point of loading it lazily. Measured at ~42 kB.
 */
const MOTION_SAVING_KB = 25;

/**
 * Kilobytes of JavaScript the browser actually pulled down for this page,
 * over the wire (compressed, as it is served). Resource timing rather than
 * response bodies: what matters is what the visitor pays for, not what the
 * bytes weigh once unpacked.
 */
async function measureJs(page: import("@playwright/test").Page, url: string): Promise<number> {
  await page.goto(url, { waitUntil: "networkidle" });
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === "script")
      .reduce((total, entry) => {
        const resource = entry as PerformanceResourceTiming;
        return total + (resource.encodedBodySize || resource.transferSize || 0);
      }, 0),
  );
  const kb = Math.round(bytes / 1024);
  console.log(`[budget] ${url} → ${kb} kB of JavaScript`);
  return kb;
}

test.describe("the public site", () => {
  // Signed out, or "/" forwards into the app and this measures the wrong page.
  test.use({ storageState: ANONYMOUS });

  test("the landing page stays inside its budget", async ({ page }) => {
    const kb = await measureJs(page, "/");
    expect(kb, `landing page downloaded ${kb} kB of JavaScript`).toBeLessThanOrEqual(
      BUDGET_KB.landing,
    );
  });

  test("renders in full with motion reduced, and loads less", async ({ browser, page }) => {
    const animated = await measureJs(page, "/");

    const context = await browser.newContext({ reducedMotion: "reduce", storageState: ANONYMOUS });
    const reduced = await context.newPage();
    const kb = await measureJs(reduced, "/");

    // Everything is there without the animation library: the server renders
    // the page visible and the hero's own copy is on screen.
    await expect(reduced.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(reduced.getByRole("link", { name: /Join the beta/ }).first()).toBeVisible();
    await expect(reduced.getByRole("contentinfo")).toBeVisible();

    const opacities = await reduced.evaluate(() =>
      [...document.querySelectorAll("main div, section")]
        .slice(0, 400)
        .map((node) => Number(getComputedStyle(node).opacity)),
    );
    expect(
      opacities.every((opacity) => opacity > 0),
      "nothing may be left invisible when motion is reduced",
    ).toBe(true);

    // The animation library is never fetched, so the page is lighter as well
    // as still. If these two ever converge, the code-splitting has been lost.
    expect(
      animated - kb,
      `reduced motion saved only ${animated - kb} kB; the motion chunk is no longer split out`,
    ).toBeGreaterThanOrEqual(MOTION_SAVING_KB);
    await context.close();
  });
});

test.describe("the app screens", () => {
  test("carry nothing the landing page needs", async ({ page }) => {
    const project = await currentProjectSlug(page);

    const roster = await measureJs(page, `/p/${project}/roster`);
    expect(roster, `roster downloaded ${roster} kB`).toBeLessThanOrEqual(BUDGET_KB.roster);

    const needsYou = await measureJs(page, `/p/${project}/needs-you`);
    expect(needsYou, `Needs you downloaded ${needsYou} kB`).toBeLessThanOrEqual(BUDGET_KB.needsYou);

  });
});
