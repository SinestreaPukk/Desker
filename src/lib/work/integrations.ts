/**
 * The two ways work leaves the building.
 *
 * `publish_post` posts a draft to a webhook the organisation connected - a
 * generic, Zapier-shaped connector, so no platform API approval stands
 * between an owner and their first published post. `send_email` goes through
 * Resend, keyed either per organisation or by the deployment's own key.
 *
 * Secrets - endpoints, signing secrets, API keys - are sealed with the vault
 * key before they are stored and opened only here, at the moment of use.
 * They are never returned to the browser, never logged, and never written
 * to an audit row. `config` holds only what is safe to display.
 */
import "server-only";
import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { open, seal } from "@/lib/vault";

export interface WebhookConfig {
  url: string;
  /** Optional shared secret; when set, every delivery carries an HMAC header. */
  secret?: string;
}

export interface EmailConfig {
  provider: "resend";
  apiKey: string;
  from: string;
}

/** Splits what an owner submitted into the displayable part and the sealed part. */
export function splitIntegrationInput(
  input:
    | { type: "webhook"; url: string; secret?: string }
    | { type: "email"; from: string; apiKey: string },
): { config: Record<string, string>; secret: string } {
  if (input.type === "webhook") {
    let host = "webhook";
    try {
      host = new URL(input.url).host;
    } catch {
      /* validated upstream */
    }
    return {
      config: { host, ...(input.secret ? { signed: "true" } : {}) },
      secret: seal({ url: input.url, ...(input.secret ? { secret: input.secret } : {}) }),
    };
  }
  return {
    config: { provider: "resend", from: input.from },
    secret: seal({ provider: "resend", from: input.from, apiKey: input.apiKey }),
  };
}

/**
 * Loads the oldest enabled connector of a kind and opens its secrets. A row
 * written before the vault existed still carries them in `config`; it is
 * sealed on first use and the plaintext removed, so the migration finishes
 * itself without a maintenance window.
 */
export async function findIntegration<T>(organizationId: string, type: "webhook" | "email") {
  const row = await prisma.integration.findFirst({
    where: { organizationId, type, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row) return null;

  if (row.secret) {
    return { id: row.id, name: row.name, config: open<T>(row.secret) };
  }

  const legacy = (row.config as Record<string, string> | null) ?? {};
  const hasSecrets = type === "webhook" ? Boolean(legacy.url) : Boolean(legacy.apiKey);
  if (!hasSecrets) return null;
  const split =
    type === "webhook"
      ? splitIntegrationInput({ type: "webhook", url: legacy.url!, secret: legacy.secret })
      : splitIntegrationInput({
          type: "email",
          from: legacy.from ?? "",
          apiKey: legacy.apiKey!,
        });
  await prisma.integration.update({
    where: { id: row.id },
    data: { config: split.config as Prisma.InputJsonValue, secret: split.secret },
  });
  return { id: row.id, name: row.name, config: open<T>(split.secret) };
}

/** Email falls back to the deployment's key so a single-tenant install needs no UI. */
export async function resolveEmail(organizationId: string): Promise<EmailConfig | null> {
  const own = await findIntegration<EmailConfig>(organizationId, "email");
  if (own?.config.apiKey && own.config.from) return own.config;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return apiKey && from ? { provider: "resend", apiKey, from } : null;
}

export interface DeliveryResult {
  ok: boolean;
  status: number;
  /** A short, non-secret description of what happened, for the result view. */
  detail: string;
}

export async function deliverWebhook(
  config: WebhookConfig,
  payload: Record<string, unknown>,
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "Desker/1.0",
  };
  if (config.secret) {
    headers["x-desker-signature"] =
      "sha256=" + createHmac("sha256", config.secret).update(body).digest("hex");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const text = (await response.text().catch(() => "")).slice(0, 300);
    return {
      ok: response.ok,
      status: response.status,
      detail: response.ok ? `Delivered (${response.status})` : `Endpoint answered ${response.status}: ${text}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: `Could not reach the endpoint: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseRecipients(to: string): string[] {
  return to
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address));
}

export async function deliverEmail(
  config: EmailConfig,
  message: { to: string[]; subject: string; text: string },
): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    return {
      ok: response.ok,
      status: response.status,
      detail: response.ok
        ? `Sent to ${message.to.join(", ")} (id ${data.id ?? "unknown"})`
        : `Resend answered ${response.status}: ${data.message ?? data.name ?? "error"}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: `Could not reach Resend: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
