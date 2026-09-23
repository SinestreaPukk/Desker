#!/usr/bin/env node
/**
 * Redesign screenshots: the same set of pages, before and after.
 *
 *   node redesign/screens.mjs before     -> redesign/before/*.png
 *   node redesign/screens.mjs after      -> redesign/after/*.png
 *
 * Needs the app on BASE (default http://localhost:3000) and the local demo
 * account from scripts/seed-demo.mjs (or DEMO_EMAIL / DEMO_PASSWORD, e.g. the
 * prisma/seed.mjs admin). Captured with reduced motion so the
 * landing page's scroll reveals and the hero reel render finished.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, process.argv[2] ?? "before");
mkdirSync(out, { recursive: true });

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL ?? "demo@northwind.example";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-password-2026";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium.launch();

async function shoot(context, path, file, { full = true } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, file), fullPage: full });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`${file}  ${path}  scrollWidth=${width}${errors.length ? `  console errors: ${errors.length}` : ""}`);
  await page.close();
  return page;
}

// Public pages, signed out -------------------------------------------------
for (const [label, viewport, mobile] of [
  ["1440", DESKTOP, false],
  ["390", MOBILE, true],
]) {
  // The public site is always light (providers.tsx forces it), so one scheme.
  const context = await browser.newContext({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
    reducedMotion: "reduce",
  });
  await shoot(context, "/", `landing-${label}.png`);
  await shoot(context, "/login", `login-${label}.png`, { full: false });
  if (!mobile) await shoot(context, "/showcase", `showcase-${label}.png`);
  await context.close();
}

// The app, signed in -------------------------------------------------------
const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce", colorScheme: "light" });
const page = await context.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await Promise.all([page.waitForURL(/\/p\/[^/]+\//, { timeout: 30_000 }), page.click('button[type="submit"]')]);
const slug = /\/p\/([^/]+)\//.exec(page.url())[1];
const agents = await (await page.request.get(`${BASE}/api/agents?project=${slug}`)).json();
const agent = Array.isArray(agents) ? agents[0] : null;
const items = await (await page.request.get(`${BASE}/api/action-items?project=${slug}`)).json();
const item =
  (Array.isArray(items) && (items.find((i) => i.status === "needs_approval") ?? items[0])) || null;
await page.close();

await shoot(context, `/p/${slug}/roster`, "app-roster-1440.png", { full: false });
await shoot(context, `/p/${slug}/work`, "app-work-approvals-1440.png", { full: false });
if (item) await shoot(context, `/p/${slug}/work?item=${item.id}`, "app-work-item-1440.png");
await shoot(context, `/p/${slug}/inbox`, "app-inbox-1440.png", { full: false });
await shoot(context, `/p/${slug}/insights`, "app-insights-1440.png", { full: false });
if (agent) {
  await shoot(context, `/p/${slug}/agents/${agent.id}`, "app-agent-builder-1440.png", { full: false });
  await shoot(context, `/c/${agent.id}`, "app-client-chat-1440.png", { full: false });
  const phone = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await shoot(phone, `/c/${agent.id}`, "app-client-chat-390.png", { full: false });
  await phone.close();
}
// Same session in the dark theme (next-themes follows the OS by default).
const dark = await browser.newContext({
  viewport: DESKTOP,
  reducedMotion: "reduce",
  colorScheme: "dark",
  storageState: await context.storageState(),
});
await shoot(dark, `/p/${slug}/work`, "app-work-approvals-1440-dark.png", { full: false });
await dark.close();

await context.close();
await browser.close();
