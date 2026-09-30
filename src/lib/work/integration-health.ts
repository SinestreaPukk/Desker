/**
 * Whether a connection is working, in three words an owner can act on.
 *
 * A raw status code or a coloured dot tells somebody that something is wrong
 * without telling them what it costs them. Each state here carries the
 * consequence instead: what an agent will fail to do while it stays this way.
 *
 * The verdict comes from the audit trail - every delivery an agent makes is
 * already recorded there with its outcome - so nothing new has to be stored
 * and nothing has to be polled.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { connectorById, connectorsForTool } from "@/lib/integrations/catalog";
import { GATED_TOOL_IDS } from "./types";


type IntegrationState = "connected" | "attention" | "disconnected";

export interface IntegrationHealth {
  state: IntegrationState;
  /** One line: what this means for the agents that use it. */
  consequence: string;
  /** When something last went through it, successfully or not. */
  lastDeliveryAt: string | null;
  lastDeliveryOk: boolean | null;
  /**
   * Agents use the oldest enabled connector of each kind; the others are
   * spares, and saying so stops an owner debugging the wrong row.
   */
  active: boolean;
}

interface Row {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  secret: string | null;
  config: unknown;
  createdAt: Date;
}

/** What agents lose when this connection is not working, as a verb phrase. */
const WHAT_IT_DOES: Record<string, string> = {
  webhook: "publish posts",
  email: "send email",
  google_calendar: "use the calendar",
  outlook_calendar: "use the calendar",
  gmail: "read and reply to email",
  outlook_mail: "read and reply to email",
  slack: "post to Slack",
  github: "read and change your code",
  linkedin: "post to LinkedIn",
  meta: "post to Facebook and Instagram",
  x: "post to X",
  threads: "post to Threads",
};

function whatItDoes(type: string): string {
  return WHAT_IT_DOES[type] ?? `use ${connectorById(type)?.name ?? type}`;
}

function hasCredentials(row: Row): boolean {
  if (row.secret) return true;
  // Rows written before the vault existed keep their settings in `config`.
  const legacy = (row.config as Record<string, string> | null) ?? {};
  return row.type === "webhook" ? Boolean(legacy.url) : Boolean(legacy.apiKey);
}

/**
 * The state of every connection in one organisation. One audit query for the
 * lot, not one per row.
 */
export async function healthForIntegrations(
  rows: Row[],
  organizationId: string,
): Promise<Map<string, IntegrationHealth>> {
  const deliveries = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: {
        in: GATED_TOOL_IDS.flatMap((tool) => [`${tool}.delivered`, `${tool}.failed`]),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { action: true, createdAt: true, metadata: true },
  });

  /** The most recent delivery attempt per connector kind. */
  const latest = new Map<string, { ok: boolean; at: Date; detail: string | null }>();
  for (const row of deliveries) {
    const [tool, outcome] = row.action.split(".");
    // A tool served by two connectors (Gmail or Outlook) belongs to whichever one is connected.
    const choices = connectorsForTool(tool ?? "");
    const type = (choices.find((connector) => rows.some((r) => r.type === connector.id && r.enabled)) ?? choices[0])?.id ?? "webhook";
    if (latest.has(type)) continue;
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    latest.set(type, {
      ok: outcome === "delivered",
      at: row.createdAt,
      detail: typeof metadata.detail === "string" ? metadata.detail : null,
    });
  }

  // Which row of each kind the runtime will actually reach for.
  const activeByType = new Map<string, string>();
  for (const row of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (row.enabled && hasCredentials(row) && !activeByType.has(row.type)) {
      activeByType.set(row.type, row.id);
    }
  }

  const health = new Map<string, IntegrationHealth>();
  for (const row of rows) {
    const active = activeByType.get(row.type) === row.id;
    const delivery = active ? (latest.get(row.type) ?? null) : null;
    const base = {
      lastDeliveryAt: delivery?.at.toISOString() ?? null,
      lastDeliveryOk: delivery?.ok ?? null,
      active,
    };

    if (!row.enabled) {
      health.set(row.id, {
        ...base,
        state: "disconnected",
        consequence: `Turned off. Agents cannot ${whatItDoes(row.type)} through it - they leave the work as a draft and say so in their report.`,
      });
      continue;
    }

    if (!hasCredentials(row)) {
      health.set(row.id, {
        ...base,
        state: "attention",
        consequence: `Nothing is stored for it, so agents cannot ${whatItDoes(row.type)} through it. Connect it again to fix it.`,
      });
      continue;
    }

    if (delivery && !delivery.ok) {
      health.set(row.id, {
        ...base,
        state: "attention",
        consequence: `The last attempt came back an error${delivery.detail ? `: ${delivery.detail}` : ""}. Anything an agent sends will fail until it works again.`,
      });
      continue;
    }

    if (!active) {
      health.set(row.id, {
        ...base,
        state: "connected",
        consequence: `A spare. Agents use the oldest working ${row.type === "email" ? "email connection" : "webhook"}, so nothing goes through this one.`,
      });
      continue;
    }

    health.set(row.id, {
      ...base,
      state: "connected",
      consequence: delivery
        ? `Working. The last thing an agent sent went through.`
        : `Ready. Nothing has been sent through it yet - approve a post or an email to try it.`,
    });
  }
  return health;
}
