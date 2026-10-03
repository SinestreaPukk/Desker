#!/usr/bin/env node
/**
 * Copies settings from .env.local to the Vercel project `desker-personal`
 * (personal.desker.dev), so a secret is typed once (into .env.local) and never
 * pasted into a chat or a form.
 *
 *   node scripts/push-env.mjs ANTHROPIC_API_KEY INNGEST_SIGNING_KEY
 *   node scripts/push-env.mjs --prefix GOOGLE_ SLACK_ LINE_
 *
 * Replaces any value already there. Values are piped to the Vercel CLI on
 * stdin and never printed. Redeploy afterwards.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const TARGET = { label: "desker-personal", projectId: "prj_KWGM4f5uRe9IE8WXpCT9ZysJDhvR" };

const local = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, raw]) => [key, raw.replace(/^["']|["']$/g, "")]),
);

const args = process.argv.slice(2);
const names =
  args[0] === "--prefix"
    ? Object.keys(local).filter((key) => args.slice(1).some((prefix) => key.startsWith(prefix)))
    : args;
if (names.length === 0) {
  console.error("Name the settings to copy, e.g. node scripts/push-env.mjs --prefix GOOGLE_ MICROSOFT_");
  process.exit(1);
}

const orgId = JSON.parse(readFileSync(".vercel/project.json", "utf8")).orgId;
let failed = false;
for (const name of names) {
  const value = local[name];
  if (!value) {
    console.error(`- ${name}: not set in .env.local, skipped`);
    failed = true;
    continue;
  }
  {
    const target = TARGET;
    const env = { ...process.env, VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: target.projectId };
    // Replace rather than duplicate: remove any existing value first (a missing one is fine).
    spawnSync("npx", ["-y", "vercel@latest", "env", "rm", name, "production", "--yes"], { env, stdio: "ignore" });
    const added = spawnSync("npx", ["-y", "vercel@latest", "env", "add", name, "production"], { env, input: value, stdio: ["pipe", "ignore", "pipe"] });
    if (added.status === 0) console.log(`✓ ${name} → ${target.label}`);
    else {
      failed = true;
      console.error(`✗ ${name} → ${target.label}: ${String(added.stderr).trim().split("\n").pop()}`);
    }
  }
}
process.exit(failed ? 1 : 0);
