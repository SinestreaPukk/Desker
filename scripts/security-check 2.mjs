#!/usr/bin/env node
/**
 * The security pass, as a script that can be re-run before every release.
 *
 *   node scripts/security-check.mjs            # after `next build`
 *
 * 1. Client bundle: no server secret name or value may appear in anything
 *    shipped to the browser.
 * 2. Database (when DATABASE_URL is set): every integration's secrets are
 *    sealed; `config` holds nothing that grants access.
 * 3. Source: no client component reads a server-only environment variable.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// --- 1. the client bundle ---------------------------------------------------
console.log("Client bundle");
const SECRET_NAMES = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "BRAVE_SEARCH_API_KEY", "TAVILY_API_KEY",
  "RESEND_API_KEY", "VAULT_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY", "AUTH_SECRET", "DATABASE_URL",
];
const SECRET_VALUES = SECRET_NAMES.map((n) => process.env[n]?.trim()).filter((v) => v && v.length >= 12);
try {
  const files = walk(".next/static").filter((f) => /\.(js|css|txt|json)$/.test(f));
  let hits = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const name of SECRET_NAMES) {
      if (text.includes(name)) { fail(`${file} mentions ${name}`); hits += 1; }
    }
    for (const value of SECRET_VALUES) {
      if (text.includes(value)) { fail(`${file} contains a secret value`); hits += 1; }
    }
  }
  if (hits === 0) ok(`${files.length} static files, no server secret names or values`);
} catch {
  console.log("  - .next/static not found; run `next build` first to check the bundle");
}

// --- 3. source: server env in client code ------------------------------------
console.log("Source");
const clientFiles = walk("src").filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").startsWith('"use client"'));
let sourceHits = 0;
for (const file of clientFiles) {
  const text = readFileSync(file, "utf8");
  const bad = [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]).filter((n) => !n.startsWith("NEXT_PUBLIC_"));
  if (bad.length > 0) { fail(`${file} reads ${bad.join(", ")} in a client component`); sourceHits += 1; }
}
if (sourceHits === 0) ok(`${clientFiles.length} client components read no server environment variables`);

// --- 2. the database ---------------------------------------------------------
if (process.env.DATABASE_URL) {
  console.log("Database");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.integration.findMany({ select: { id: true, type: true, config: true, secret: true } });
    let bad = 0;
    for (const row of rows) {
      const config = JSON.stringify(row.config ?? {});
      if (!row.secret || !row.secret.startsWith("v1.")) { fail(`integration ${row.id} (${row.type}) has no sealed secret`); bad += 1; }
      if (/apiKey|"url"|"secret"|https?:\/\//.test(config)) { fail(`integration ${row.id} config holds a secret-looking field`); bad += 1; }
    }
    if (bad === 0) ok(`${rows.length} integration(s), all sealed, no secrets in config`);
    const users = await prisma.user.count({ where: { termsAcceptedAt: null } });
    if (users > 0) console.log(`  - ${users} user(s) predate the consent step (accepted nothing on record)`);
    else ok("every user has a recorded terms acceptance");
  } finally {
    await prisma.$disconnect();
  }
}

console.log(failures === 0 ? "\nSecurity check passed." : `\n${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
