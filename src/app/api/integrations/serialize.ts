import "server-only";
import type { IntegrationDto } from "@/lib/work/serialize";
import type { IntegrationHealth } from "@/lib/work/integration-health";

/** Endpoints and keys never leave the server; the list shows a hostname or a from-address. */
export function toIntegrationDto(
  row: {
    id: string;
    type: string;
    name: string;
    config: unknown;
    enabled: boolean;
    createdAt: Date;
  },
  health?: IntegrationHealth,
): IntegrationDto {
  // `config` is the displayable part only; secrets live sealed in `secret`.
  const config = (row.config as Record<string, string> | null) ?? {};
  let summary = "";
  if (row.type === "webhook") {
    summary = `${config.platform ? `${config.platform} · ` : ""}${config.host ?? "webhook"}`;
    if (config.signed === "true" || config.secret) summary += " · signed";
  } else if (row.type === "email") {
    summary = `from ${config.from ?? "?"} · Resend`;
  } else if (row.type === "phone") {
    summary = `${config.from ?? "?"} · Twilio ${config.account ?? ""}`;
  } else {
    summary = config.account ?? "";
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    summary,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    // A freshly created row has nothing to judge yet: it is connected and
    // waiting for its first delivery.
    state: health?.state ?? (row.enabled ? "connected" : "disconnected"),
    consequence:
      health?.consequence ??
      (row.enabled
        ? "Ready. Nothing has been sent through it yet - approve a post or an email to try it."
        : "Turned off. Agents leave the work as a draft instead."),
    lastDeliveryAt: health?.lastDeliveryAt ?? null,
    lastDeliveryOk: health?.lastDeliveryOk ?? null,
    active: health?.active ?? row.enabled,
  };
}

