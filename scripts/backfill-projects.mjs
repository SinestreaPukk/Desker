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

async function ensureProjects() {
  if (!(await tableExists("Project"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Project" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug")`,
    );
    console.log("[backfill] created Project table.");
  }

  const existing = await prisma.$queryRawUnsafe(
    sql(`SELECT id FROM "Project" WHERE slug = $1 LIMIT 1`),
    DEFAULT_PROJECT_SLUG,
  );
  let projectId = existing[0]?.id;
  if (!projectId) {
    projectId = newId("prj");
    await prisma.$executeRawUnsafe(
      sql(`INSERT INTO "Project" ("id", "name", "slug", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`),
      projectId,
      DEFAULT_PROJECT_NAME,
      DEFAULT_PROJECT_SLUG,
    );
    console.log(`[backfill] created default project ${projectId}.`);
  }

  if (!(await columnExists("Agent", "projectId"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Agent" ADD COLUMN "projectId" TEXT`);
    console.log("[backfill] added Agent.projectId.");
  }

  const updated = await prisma.$executeRawUnsafe(
    sql(`UPDATE "Agent" SET "projectId" = $1 WHERE "projectId" IS NULL`),
    projectId,
  );
  if (updated > 0) console.log(`[backfill] assigned ${updated} agent(s) to the default project.`);
}

async function ensureOrganizations() {
  if (!(await tableExists("Organization"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Organization" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug")`,
    );
    console.log("[backfill] created Organization table.");
  }

  if (!(await tableExists("Membership"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Membership" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'member',
        "createdAt" ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId")`,
    );
    console.log("[backfill] created Membership table.");
  }

  // Only a database that already has projects without an owner needs a
  // default organisation. A fresh install gets its first one at sign-up.
  const hasOrgColumn = await columnExists("Project", "organizationId");
  const orphaned = hasOrgColumn
    ? await prisma.$queryRawUnsafe(`SELECT id FROM "Project" WHERE "organizationId" IS NULL`)
    : await prisma.$queryRawUnsafe(`SELECT id FROM "Project"`);
  if (orphaned.length === 0) return;

  const existing = await prisma.$queryRawUnsafe(
    sql(`SELECT id FROM "Organization" WHERE slug = $1 LIMIT 1`),
    DEFAULT_ORG_SLUG,
  );
  let organizationId = existing[0]?.id;
  if (!organizationId) {
    organizationId = newId("org");
    await prisma.$executeRawUnsafe(
      sql(`INSERT INTO "Organization" ("id", "name", "slug", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`),
      organizationId,
      DEFAULT_ORG_NAME,
      DEFAULT_ORG_SLUG,
    );
    console.log(`[backfill] created default organization ${organizationId}.`);
  }

  if (!hasOrgColumn) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT`);
    console.log("[backfill] added Project.organizationId.");
  }

  const projects = await prisma.$executeRawUnsafe(
    sql(`UPDATE "Project" SET "organizationId" = $1 WHERE "organizationId" IS NULL`),
    organizationId,
  );
  if (projects > 0) {
    console.log(`[backfill] assigned ${projects} project(s) to the default organization.`);
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

async function main() {
  if (!(await tableExists("Agent"))) {
    console.log("[backfill] fresh database; db push will create everything.");
    return;
  }
  await ensureProjects();
  await ensureOrganizations();
}

main()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
