import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The load test: many scheduled agents firing in one tick. Not part of the
 * normal suites - it takes a minute and hammers the database on purpose.
 *
 * It needs a database of its own, named in LOAD_DATABASE_URL: pointed at a
 * database a running app also uses, that app's scheduler sees the test's
 * schedules and fires them for real. LOAD_ORGS / LOAD_AGENTS_PER_ORG resize it.
 */
const loadDatabase = process.env.LOAD_DATABASE_URL?.trim();
if (!loadDatabase) {
  throw new Error("Set LOAD_DATABASE_URL to a database used only by the load test (see README: Load test).");
}

export default defineConfig({
  test: {
    env: { DATABASE_URL: loadDatabase },
    include: ["tests/load/**/*.test.ts"],
    environment: "node",
    testTimeout: 15 * 60_000,
    hookTimeout: 5 * 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
