// Phase 1 CTA comparison: hero + pricing at 1440, hero at 390. Usage: node redesign/mock-cta.mjs <label>
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const label = process.argv[2];
const out = new URL(`./mocks/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}cta-${label}-hero-${w}.png` });
  if (!mobile) {
    await page.locator("#pricing").screenshot({ path: `${out}cta-${label}-pricing-${w}.png` });
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}cta-${label}-header-scrolled-${w}.png`, clip: { x: 0, y: 0, width: w, height: 72 } });
  }
  await ctx.close();
}
await browser.close();
