/**
 * Makes the database scripts see the same environment the app does.
 *
 * Next reads `.env.local` and then `.env`. The Prisma CLI and these scripts
 * read only `.env`, so a checkout that keeps its local database URL in
 * `.env.local` - which is what the README tells you to do to run without
 * Docker - leaves `npm run db:push` pointed at nothing, and
 * `scripts/gen-schema.mjs` falling back to its postgresql default and
 * rewriting the tracked schema for the wrong provider on its way past.
 *
 * Values already in the environment always win, so a deployment that sets
 * DATABASE_URL for real is never overridden by a file that happens to exist.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The subset of dotenv this repo's files actually use. */
function parse(text) {
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

export function loadEnv() {
  // Later files do not override earlier ones, and nothing overrides the
  // environment that is already set - same precedence as Next.
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parse(readFileSync(path, "utf8")))) {
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadEnv();
