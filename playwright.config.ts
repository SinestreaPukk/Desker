import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Boots the production artifact (the same standalone server the Docker image
 * runs) so `npm run test:e2e` works from a clean checkout with nothing running.
 * The chat specs need a live ANTHROPIC_API_KEY and skip themselves without one;
 * everything else runs regardless.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Absolute, because the standalone server runs with its cwd set to
 * .next/standalone - a relative sqlite path there resolves to a different
 * (empty) file than the one `prisma db push` creates at the project root.
 */
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `file:${process.cwd()}/e2e.db`;
// The spec process opens the same database directly (auth.setup adjusts the
// shared organisation's plan). Prisma resolves a relative sqlite path against
// the schema file, so both sides must see the same absolute one.
process.env.DATABASE_URL = DATABASE_URL;
// Relative to the project root, which is where Playwright is invoked from.
const ADMIN_STATE = "tests/e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
      dependencies: ["setup"],
    },
    {
      // A phone viewport, because the widget and chat must work at 360px.
      name: "mobile",
      use: { ...devices["Pixel 5"], storageState: ADMIN_STATE },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    // Self-contained: schema, build, then serve the production artifact.
    command: `npm run db:push && npm run build:standalone && PORT=${PORT} npm run start:standalone`,
    url: `${BASE_URL}/api/health`,
    timeout: 300_000,
    // Always start a fresh server. Reusing one silently attaches to whatever
    // is already on the port - including a leftover process still holding a
    // deleted database file, which produces failures that look like app bugs.
    // Opt in explicitly with E2E_REUSE_SERVER=true when iterating locally.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "true",
    env: {
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? "sqlite",
      DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-not-for-production-use",
      AUTH_TRUST_HOST: "true",
      EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER ?? "local",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // No Inngest server in the e2e run; keep the SDK out of cloud mode so
      // /api/inngest does not demand a signing key.
      INNGEST_DEV: process.env.INNGEST_DEV ?? "1",
      // Integrations need a vault key; plan limits are exercised by the team
      // spec, which signs up a fresh organisation for it.
      VAULT_KEY: process.env.VAULT_KEY ?? "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
      ENFORCE_PLAN_LIMITS: "true",
    },
  },
});
