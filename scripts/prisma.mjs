#!/usr/bin/env node
/**
 * The Prisma CLI, with the environment the app uses.
 *
 * `npx prisma` loads `.env` and nothing else, so on a checkout whose local
 * database lives in `.env.local` every `prisma` subcommand in package.json
 * talked to the wrong database - or none. This forwards its arguments after
 * loading both files. See scripts/load-env.mjs.
 *
 *   node scripts/prisma.mjs db push
 */
import { spawnSync } from "node:child_process";
import "./load-env.mjs";

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
