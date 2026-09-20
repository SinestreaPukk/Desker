#!/usr/bin/env node
/**
 * Assembles the Next.js standalone output into a runnable server.
 *
 * `output: "standalone"` emits .next/standalone/server.js but deliberately
 * leaves out static assets, so they have to be copied alongside it. The
 * Dockerfile does exactly this; running the same step locally means the e2e
 * suite exercises the production artifact rather than the dev server.
 */
import { cp, access } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

try {
  await access(standalone);
} catch {
  console.error("No .next/standalone directory. Run `npm run build` first.");
  process.exit(1);
}

await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
await cp(join(root, "public"), join(standalone, "public"), { recursive: true });

console.log("standalone server ready: node .next/standalone/server.js");
