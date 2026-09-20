import "server-only";
import type { IntegrationDto } from "@/lib/work/serialize";

/** Endpoints and keys never leave the server; the list shows a hostname or a from-address. */
export function toIntegrationDto(row: {
  id: string;
  type: string;
  name: string;
  config: unknown;
  enabled: boolean;
  createdAt: Date;
}): IntegrationDto {
  const config = (row.config as Record<string, string> | null) ?? {};
  let summary = "";
  if (row.type === "webhook") {
    try {
      summary = new URL(config.url ?? "").host;
    } catch {
      summary = "webhook";
    }
    if (config.secret) summary += " · signed";
  } else if (row.type === "email") {
    summary = `from ${config.from ?? "?"} · Resend`;
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    summary,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

