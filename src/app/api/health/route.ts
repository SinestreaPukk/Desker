import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { activeEmbeddingBackend } from "@/lib/rag/embeddings";
import { heartbeatStatus } from "@/lib/jobs/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + configuration probe. Never returns secret values, only presence.
 *
 * `ok` is the database only: a fresh deployment has no heartbeat yet and must
 * still pass its first health check. `jobs.alive` is reported separately so
 * an uptime monitor can alert on a dead scheduler specifically.
 */
export async function GET() {
  let database: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  const jobs =
    database === "up"
      ? await heartbeatStatus().catch(() => null)
      : null;

  return NextResponse.json(
    {
      ok: database === "up",
      database,
      jobs: jobs ?? { lastHeartbeatAt: null, ageMs: null, intervalMs: null, alive: false },
      databaseProvider: env.databaseProvider,
      embeddingBackend: activeEmbeddingBackend(),
      anthropicKeyConfigured: env.hasAnthropicKey,
      anthropicWorkspaceConfigured: Boolean(env.anthropicWorkspaceId),
      openaiKeyConfigured: env.hasOpenAiKey,
      defaultModel: env.anthropicDefaultModel,
    },
    { status: database === "up" ? 200 : 503 },
  );
}
