#!/usr/bin/env node
/**
 * Applies the schema to a deployed database with a guard that understands
 * the difference between "might lose data" and "will lose data".
 *
 * `prisma db push` refuses to add a unique index without --accept-data-loss,
 * because duplicates *could* exist - which blocks every deploy that adds one,
 * while the flag that unblocks it would also wave through a dropped column.
 * So: compute the SQL Prisma would run, refuse if it drops a table or a
 * column (unless ALLOW_DESTRUCTIVE_MIGRATION=1 says that was intended), and
 * otherwise push with the flag. Every refusal prints the exact statements.
 */
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db-deploy] DATABASE_URL is not set.");
  process.exit(1);
}

function prisma(args, opts = {}) {
  return execFileSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
    ...opts,
  });
}

let sql = "";
try {
  sql = prisma([
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ]);
} catch (error) {
  console.error("[db-deploy] could not diff the database against the schema.", error?.message ?? error);
  process.exit(1);
}

const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

if (statements.length === 0) {
  console.log("[db-deploy] database already matches the schema.");
  process.exit(0);
}

const destructive = statements.filter((s) => /\bDROP\s+(TABLE|COLUMN)\b/i.test(s));
if (destructive.length > 0 && process.env.ALLOW_DESTRUCTIVE_MIGRATION !== "1") {
  console.error("[db-deploy] refusing: this change drops data.\n");
  for (const s of destructive) console.error(`  ${s};`);
  console.error(
    "\nIf that is intended, redeploy with ALLOW_DESTRUCTIVE_MIGRATION=1. Otherwise fix the schema.",
  );
  process.exit(1);
}

console.log(`[db-deploy] applying ${statements.length} statement(s):`);
for (const s of statements) console.log(`  ${s.split("\n")[0]}${s.includes("\n") ? " …" : ""};`);
prisma(["db", "push", "--skip-generate", "--accept-data-loss"], { stdio: "inherit" });
