#!/usr/bin/env node
// Landing page at the four review widths, full page. Reports console errors
// and horizontal overflow. Usage: node redesign/landing-shots.mjs <folder>
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const out = join(dirname(fileURLToPath(import.meta.url)), process.argv[2] ?? "phase2");
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
for (const width of [390, 768, 1280, 1440]) {
  const mobile = width < 768;
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `landing-${width}.png`), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`landing-${width}.png overflow=${overflow}px errors=${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`);
  await context.close();
}
await browser.close();
