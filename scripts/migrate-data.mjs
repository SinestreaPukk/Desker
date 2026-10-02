#!/usr/bin/env node
/**
 * Data changes that ride along with a schema change. Runs after the schema is
 * current, is safe to run repeatedly, and every step is a no-op once applied.
 *
 *   1. The chat tool `search_company_context` and the work tool
 *      `search_context` became the one `search_documents`. Saved tool lists
 *      on agents and scopes of work are rewritten to the new id.
 *   2. The sign-up question became business | personal | mixed. The old
 *      "freelancer" and "startup" answers were both business use.
 */
// Must precede @prisma/client (see backfill-projects.mjs).
import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RENAMED = { search_company_context: "search_documents", search_context: "search_documents" };

/** The renamed list, or null when nothing in it changes. */
export function renameTools(tools) {
  if (!Array.isArray(tools) || !tools.some((tool) => tool in RENAMED)) return null;
  return [...new Set(tools.map((tool) => RENAMED[tool] ?? tool))];
}

async function main() {
  let agents = 0;
  for (const agent of await prisma.agent.findMany({ select: { id: true, allowedTools: true } })) {
    const next = renameTools(agent.allowedTools);
    if (!next) continue;
    await prisma.agent.update({ where: { id: agent.id }, data: { allowedTools: next } });
    agents++;
  }
  let scopes = 0;
  for (const scope of await prisma.scopeOfWork.findMany({ select: { id: true, tools: true } })) {
    const next = renameTools(scope.tools);
    if (!next) continue;
    await prisma.scopeOfWork.update({ where: { id: scope.id }, data: { tools: next } });
    scopes++;
  }
  console.log(`[migrate-data] search_documents: ${agents} agent(s), ${scopes} scope(s) updated`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error("[migrate-data] failed", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
