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
  // `config` is the displayable part only; secrets live sealed in `secret`.
  const config = (row.config as Record<string, string> | null) ?? {};
  let summary = "";
  if (row.type === "webhook") {
    summary = config.host ?? "webhook";
    if (config.signed === "true" || config.secret) summary += " · signed";
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

