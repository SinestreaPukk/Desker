#!/usr/bin/env node
/**
 * Generates prisma/schema.prisma from prisma/schema.template.prisma for the
 * provider named by DATABASE_PROVIDER (postgresql | sqlite).
 *
 *   node scripts/gen-schema.mjs            # uses DATABASE_PROVIDER, default postgresql
 *   node scripts/gen-schema.mjs sqlite     # explicit override
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED = ["postgresql", "sqlite"];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const provider =
  process.argv[2] ?? process.env.DATABASE_PROVIDER ?? "postgresql";

if (!SUPPORTED.includes(provider)) {
  console.error(
    `Unknown DATABASE_PROVIDER "${provider}". Expected one of: ${SUPPORTED.join(", ")}`,
  );
  process.exit(1);
}

const template = readFileSync(
  join(root, "prisma", "schema.template.prisma"),
  "utf8",
);

const lines = template.split("\n");
const out = [];
/** @type {string[]} */
const stack = [];

for (const line of lines) {
  const open = line.match(/^\s*\/\/#IF\s+(\S+)\s*$/);
  if (open) {
    stack.push(open[1]);
    continue;
  }
  if (/^\s*\/\/#ENDIF\s*$/.test(line)) {
    if (stack.length === 0) throw new Error("Unbalanced //#ENDIF in template");
    stack.pop();
    continue;
  }
  if (stack.every((p) => p === provider)) out.push(line);
}

if (stack.length > 0) throw new Error("Unclosed //#IF in template");

const header = `// AUTO-GENERATED from prisma/schema.template.prisma for provider "${provider}".\n// Run \`npm run db:schema\` to regenerate. Do not edit by hand.\n\n`;
const body = out.join("\n").replace("__PROVIDER__", provider);

writeFileSync(join(root, "prisma", "schema.prisma"), header + body);
console.log(`prisma/schema.prisma generated for provider: ${provider}`);
