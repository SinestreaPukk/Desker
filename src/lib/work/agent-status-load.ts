/**
 * The facts behind each agent's status, gathered for a whole project in a
 * handful of queries rather than several per agent. What they mean is decided
 * in agent-status.ts.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { CONNECTORS, connectorForTool } from "@/lib/integrations/catalog";
import { healthForIntegrations } from "./integration-health";
import { resolveEmail } from "./integrations";
import { runModeOf } from "./cadence";
import { nextFire } from "./scope";
import { scopeTools } from "./tools";
import type { AgentStatusFacts, ConnectionProblem } from "./agent-status";

// ponytail: the newest 300 runs in the project cover every agent's latest run in practice; a per-agent "latest" column if rosters grow past that.
const RECENT_RUNS = 300;

function titleOf(run: { headline: string | null; error: string | null; trigger: string }): string {
  return run.headline ?? run.error ?? (run.trigger === "schedule" ? "Scheduled run" : "Run");
}

export async function agentStatusFacts(projectId: string, organizationId: string): Promise<Map<string, AgentStatusFacts>> {
  const [agents, runs, flags, integrations, email] = await Promise.all([
    prisma.agent.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        scopeOfWork: { select: { triggerType: true, cron: true, timezone: true, enabled: true, tools: true } },
      },
    }),
    prisma.actionItem.findMany({
      where: { agent: { projectId } },
      orderBy: { createdAt: "desc" },
      take: RECENT_RUNS,
      select: {
        id: true,
        agentId: true,
        status: true,
        trigger: true,
        headline: true,
        error: true,
        approvedAt: true,
        scheduledFor: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.issue.findMany({
      where: { status: "open", type: { in: ["escalation", "failure"] }, agent: { projectId } },
      orderBy: { createdAt: "desc" },
      select: { id: true, agentId: true },
    }),
    prisma.integration.findMany({
      where: { organizationId },
      select: { id: true, type: true, name: true, enabled: true, secret: true, config: true, createdAt: true },
    }),
    resolveEmail(organizationId),
  ]);
  const health = await healthForIntegrations(integrations, organizationId);

  /** What stands between an agent and each connector its tools need. */
  function connectionProblems(tools: string[] | null): ConnectionProblem[] {
    // No explicit list means "every tool": it was never told it needs a connection.
    if (!tools) return [];
    const needed = new Map<string, (typeof CONNECTORS)[number]>();
    for (const tool of tools) {
      const connector = connectorForTool(tool);
      if (connector && connector.status === "available") needed.set(connector.id, connector);
    }
    const problems: ConnectionProblem[] = [];
    for (const connector of needed.values()) {
      if (connector.id === "email" && email) continue;
      const rows = integrations.filter((row) => row.type === connector.id);
      const states = rows.map((row) => health.get(row.id)).filter(Boolean);
      const active = states.find((state) => state!.active);
      if (active?.state === "connected") continue;
      if (active) {
        problems.push({ connectorId: connector.id, name: connector.name, state: "attention", consequence: active.consequence });
      } else if (states.length > 0) {
        problems.push({ connectorId: connector.id, name: connector.name, state: "off", consequence: states[0]!.consequence });
      } else {
        problems.push({
          connectorId: connector.id,
          name: connector.name,
          state: "missing",
          consequence: `Its work needs ${connector.name}, which isn't connected, so that part stays a draft.`,
        });
      }
    }
    return problems;
  }

  const facts = new Map<string, AgentStatusFacts>();
  const now = new Date();
  for (const agent of agents) {
    const mine = runs.filter((run) => run.agentId === agent.id);
    const scope = agent.scopeOfWork;
    const mode = runModeOf(scope);
    const cronNext =
      scope && mode.mode === "scheduled" ? nextFire(scope.cron, scope.timezone, now)?.toISOString() ?? null : null;
    const queuedNext = mine
      .filter((run) => run.status === "queued" && run.scheduledFor && run.scheduledFor > now)
      .map((run) => run.scheduledFor!.toISOString())
      .sort()[0];
    const waiting = mine.filter((run) => run.status === "needs_approval");
    const myFlags = flags.filter((flag) => flag.agentId === agent.id);
    const running = mine.find((run) => run.status === "in_progress");
    const last = mine.find((run) => ["done", "failed", "rejected", "needs_approval", "approved", "executing_external"].includes(run.status));

    facts.set(agent.id, {
      published: agent.status === "published",
      runMode: mode.mode,
      cadence: mode.cadence,
      nextRunAt: [cronNext, queuedNext].filter(Boolean).sort()[0] ?? null,
      running: running ? { id: running.id } : null,
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            at: (last.completedAt ?? last.createdAt).toISOString(),
            title: titleOf(last),
            error: last.error,
            deliveryFailed: last.status === "failed" && Boolean(last.approvedAt),
          }
        : null,
      waiting: waiting.length > 0 ? { id: waiting[0]!.id, count: waiting.length } : null,
      flags: myFlags.length > 0 ? { id: myFlags[0]!.id, count: myFlags.length } : null,
      connections: connectionProblems(scopeTools(scope?.tools)),
    });
  }
  return facts;
}
