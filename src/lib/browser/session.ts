/**
 * A real browser the assistant can drive. In production it is a hosted cloud
 * browser (Browserbase), connected over CDP: serverless hosts cannot run one.
 * Locally, BROWSER_LOCAL=1 launches Chromium on this machine for development.
 */
import "server-only";
import { chromium, type Browser, type Page } from "playwright-core";

/** One fixed size: screenshots stay small, and the model's coordinates map 1:1 onto the page. */
export const VIEWPORT = { width: 1024, height: 768 } as const;

export function browserConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY?.trim() && process.env.BROWSERBASE_PROJECT_ID?.trim()) || process.env.BROWSER_LOCAL === "1";
}

export interface BrowserSession {
  page: Page;
  close(): Promise<void>;
}

const API = "https://api.browserbase.com/v1";

async function cloud(): Promise<BrowserSession> {
  const headers = { "x-bb-api-key": process.env.BROWSERBASE_API_KEY!.trim(), "content-type": "application/json" };
  const projectId = process.env.BROWSERBASE_PROJECT_ID!.trim();
  const created = await fetch(`${API}/sessions`, {
    method: "POST",
    headers,
    // 10 minutes is more than one task needs; the session is released as soon as the task ends.
    body: JSON.stringify({ projectId, timeout: 600, browserSettings: { viewport: VIEWPORT } }),
  });
  if (!created.ok) throw new Error(`The cloud browser would not start (${created.status}).`);
  const { id, connectUrl } = (await created.json()) as { id: string; connectUrl: string };
  const browser: Browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize(VIEWPORT);
  return {
    page,
    async close() {
      await browser.close().catch(() => undefined);
      await fetch(`${API}/sessions/${id}`, { method: "POST", headers, body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) }).catch(() => undefined);
    },
  };
}

async function local(): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  return { page, close: () => browser.close() };
}

export async function openBrowser(): Promise<BrowserSession> {
  if (process.env.BROWSER_LOCAL === "1") return local();
  if (!browserConfigured()) throw new Error("The browser is not set up on this server yet.");
  return cloud();
}
