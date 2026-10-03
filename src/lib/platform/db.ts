import { Prisma, PrismaClient } from "@prisma/client";

/**
 * One client per process, kept on globalThis: Next.js hot-reloads modules in
 * dev, which would otherwise open a new pool on every edit until Postgres
 * refuses connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Dev only: a client cached from before `prisma generate` is missing the new models. */
function stale(client: PrismaClient): boolean {
  return Object.values(Prisma.ModelName).some((model) => !(model.charAt(0).toLowerCase() + model.slice(1) in client));
}

function current(): PrismaClient {
  let client = globalForPrisma.prisma;
  if (!client || (process.env.NODE_ENV !== "production" && stale(client))) {
    client = createPrismaClient();
    globalForPrisma.prisma = client;
  }
  return client;
}

// Resolved on each use rather than captured at import, so modules that
// imported it before a dev schema change still reach the fresh client.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = current();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
