import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Hits a real database; the agent-turn spec also hits a real model API and
    // skips itself without ANTHROPIC_API_KEY. The rest need only DATABASE_URL.
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    // A full tool-using turn against a live model can take a while.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
