#!/usr/bin/env node
/**
 * Upgrade path for the tenancy columns added after the first release.
 *
 * Two required foreign keys were introduced on populated tables, and a plain
 * `db push` cannot add a NOT NULL column to rows that already exist:
 *
 *   1. Agent.projectId     - every agent belongs to a project
 *   2. Project.organizationId - every project belongs to an organisation
 *
 * This runs before `db push` and makes each step a no-op change:
 *
 *   - creates the Project / Organization / Membership tables if missing
 *   - ensures a default project and a default organisation exist
 *   - adds the foreign-key column as nullable and points every existing row
 *     at the default
 *   - makes every existing user an owner of the default organisation, since a
 *     pre-tenancy install was one shared workspace
 *
 * On a fresh database every step is a no-op and `db push` creates the schema
 * normally. Safe to run repeatedly. Works on both PostgreSQL and SQLite so a
 * developer's existing dev.db upgrades the same way a server does.
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

const provider = process.env.DATABASE_PROVIDER ?? "postgresql";
const isSqlite = provider === "sqlite";
const prisma = new PrismaClient();

const DEFAULT_PROJECT_NAME = process.env.DEFAULT_PROJECT_NAME ?? "Default project";
const DEFAULT_PROJECT_SLUG = "default";
const DEFAULT_ORG_NAME = process.env.DEFAULT_ORGANIZATION_NAME ?? "My organization";
const DEFAULT_ORG_SLUG = "default";

/** Postgres uses $1 placeholders, SQLite uses ?. */
const sql = (text) => (isSqlite ? text.replace(/\$\d+/g, "?") : text);
const timestamp = isSqlite ? "DATETIME" : "TIMESTAMP(3)";

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function tableExists(name) {
  if (isSqlite) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      name,
    );
    return rows.length > 0;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."${name}"') IS NOT NULL AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function columnExists(table, column) {
  if (isSqlite) {
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    return rows.some((row) => row.name === column);
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = '${table}' AND column_name = '${column}'
     ) AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function ensureTable(name, ddl, indexDdl) {
  if (await tableExists(name)) return;
  await prisma.$executeRawUnsafe(ddl);
  await prisma.$executeRawUnsafe(indexDdl);
  console.log(`[backfill] created ${name} table.`);
}

async function ensureNullableColumn(table, column) {
  if (await columnExists(table, column)) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" TEXT`);
  console.log(`[backfill] added ${table}.${column}.`);
}

async function findOrCreate(table, slug, name, extraColumns = {}) {
  const existing = await prisma.$queryRawUnsafe(
    sql(`SELECT id FROM "${table}" WHERE slug = $1 LIMIT 1`),
    slug,
  );
  if (existing[0]?.id) return existing[0].id;

  const id = newId(table === "Organization" ? "org" : "prj");
  const columns = ["id", "name", "slug", ...Object.keys(extraColumns)];
  const values = [id, name, slug, ...Object.values(extraColumns)];
  await prisma.$executeRawUnsafe(
    sql(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}, "updatedAt")
       VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")}, CURRENT_TIMESTAMP)`,
    ),
    ...values,
  );
  console.log(`[backfill] created default ${table.toLowerCase()} ${id}.`);
  return id;
}

/**
 * Issue.agentId arrived when agents started raising issues about themselves.
 * Existing rows all came from conversations, so the agent is the
 * conversation's agent.
 */
async function ensureIssueAgent() {
  if (!(await tableExists("Issue")) || (await columnExists("Issue", "agentId"))) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "Issue" ADD COLUMN "agentId" TEXT`);
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "Issue" SET "agentId" = (SELECT c."agentId" FROM "Conversation" c WHERE c.id = "Issue"."conversationId")
     WHERE "agentId" IS NULL`,
  );
  console.log(`[backfill] added Issue.agentId and filled ${updated} row(s).`);
}

/**
 * Same format as lib/vault.ts (v1.<iv>.<tag>.<ciphertext>, base64url); the
 * cross-check test in tests/unit/vault.test.ts keeps the two in step.
 */
function seal(value) {
  const raw = process.env.VAULT_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/**
 * Integration secrets written before the vault existed sit in plain text in
 * `config`. Seal them now, so no row waits for its first use to be protected.
 */
async function sealLegacyIntegrations() {
  if (!(await tableExists("Integration")) || !(await columnExists("Integration", "secret"))) return;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, type, config FROM "Integration" WHERE "secret" IS NULL`,
  );
  if (rows.length === 0) return;
  if (!process.env.VAULT_KEY?.trim()) {
    console.warn(`[backfill] ${rows.length} integration(s) hold plain-text secrets and VAULT_KEY is not set; they stay unsealed.`);
    return;
  }
  let sealed = 0;
  for (const row of rows) {
    const config = typeof row.config === "string" ? JSON.parse(row.config) : (row.config ?? {});
    let display;
    let secret;
    if (row.type === "webhook" && config.url) {
      let host = "webhook";
      try { host = new URL(config.url).host; } catch {}
      display = { host, ...(config.secret ? { signed: "true" } : {}) };
      secret = seal({ url: config.url, ...(config.secret ? { secret: config.secret } : {}) });
    } else if (row.type === "email" && config.apiKey) {
      display = { provider: "resend", from: config.from ?? "" };
      secret = seal({ provider: "resend", from: config.from ?? "", apiKey: config.apiKey });
    } else {
      continue;
    }
    if (!secret) continue;
    await prisma.$executeRawUnsafe(
      sql(`UPDATE "Integration" SET "config" = $1, "secret" = $2 WHERE id = $3`),
      isSqlite ? JSON.stringify(display) : display,
      secret,
      row.id,
    );
    sealed += 1;
  }
  if (sealed > 0) console.log(`[backfill] sealed ${sealed} integration secret(s) that were stored in plain text.`);
}

async function main() {
  if (!(await tableExists("Agent"))) {
    console.log("[backfill] fresh database; db push will create everything.");
    return;
  }
  await ensureIssueAgent();
  await sealLegacyIntegrations();

  await ensureTable(
    "Project",
    `CREATE TABLE "Project" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "name" TEXT NOT NULL,
       "slug" TEXT NOT NULL,
       "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug")`,
  );
  await ensureTable(
    "Organization",
    `CREATE TABLE "Organization" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "name" TEXT NOT NULL,
       "slug" TEXT NOT NULL,
       "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug")`,
  );
  await ensureTable(
    "Membership",
    `CREATE TABLE "Membership" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "userId" TEXT NOT NULL,
       "organizationId" TEXT NOT NULL,
       "role" TEXT NOT NULL DEFAULT 'member',
       "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId")`,
  );

  // The columns `db push` would otherwise fail to add. Nullable here; the push
  // that follows tightens them once every row has a value.
  await ensureNullableColumn("Agent", "projectId");
  await ensureNullableColumn("Project", "organizationId");

  const orphanAgents = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Agent" WHERE "projectId" IS NULL`,
  );
  const orphanProjects = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Project" WHERE "organizationId" IS NULL`,
  );

  // Nothing to attach means nothing to create: a database that already has
  // the current schema, empty or not, is left exactly as it is.
  if (orphanAgents.length === 0 && orphanProjects.length === 0) {
    console.log("[backfill] nothing to do.");
    return;
  }

  const organizationId = await findOrCreate("Organization", DEFAULT_ORG_SLUG, DEFAULT_ORG_NAME);

  if (orphanProjects.length > 0) {
    await prisma.$executeRawUnsafe(
      sql(`UPDATE "Project" SET "organizationId" = $1 WHERE "organizationId" IS NULL`),
      organizationId,
    );
    console.log(
      `[backfill] assigned ${orphanProjects.length} project(s) to the default organization.`,
    );
  }

  if (orphanAgents.length > 0) {
    const projectId = await findOrCreate("Project", DEFAULT_PROJECT_SLUG, DEFAULT_PROJECT_NAME, {
      organizationId,
    });
    await prisma.$executeRawUnsafe(
      sql(`UPDATE "Agent" SET "projectId" = $1 WHERE "projectId" IS NULL`),
      projectId,
    );
    console.log(`[backfill] assigned ${orphanAgents.length} agent(s) to the default project.`);
  }

  // Everyone who could sign in before tenancy existed shared one workspace, so
  // they all become owners of the organisation that now holds it.
  const users = await prisma.$queryRawUnsafe(
    sql(`SELECT u.id FROM "User" u
         WHERE NOT EXISTS (
           SELECT 1 FROM "Membership" m WHERE m."userId" = u.id AND m."organizationId" = $1
         )`),
    organizationId,
  );
  for (const user of users) {
    await prisma.$executeRawUnsafe(
      sql(`INSERT INTO "Membership" ("id", "userId", "organizationId", "role") VALUES ($1, $2, $3, 'owner')`),
      newId("mem"),
      user.id,
      organizationId,
    );
  }
  if (users.length > 0) {
    console.log(`[backfill] made ${users.length} existing user(s) owners of the default organization.`);
  }
}

main()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
