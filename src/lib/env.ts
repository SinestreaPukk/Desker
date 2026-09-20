/**
 * Server-side environment access.
 *
 * Everything here is server-only. Nothing in this module may be imported from a
 * client component - the API keys would end up in the browser bundle.
 */
import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  /** Throws only when an Anthropic-backed agent is actually invoked. */
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get hasOpenAiKey() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  },
  get hasAnthropicKey() {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  },

  /**
   * Default Claude model. Verified against the current model list at
   * https://docs.claude.com - `claude-sonnet-4-6` is a live model id with a 1M
   * context window. Model ids from this family carry no date suffix.
   */
  anthropicDefaultModel: optional("ANTHROPIC_DEFAULT_MODEL", "claude-sonnet-4-6"),

  /**
   * Required only for an organisation-level API key. Keys scoped to a single
   * workspace carry that context themselves; an unscoped key is rejected with
   * a 400 unless every request names the workspace to bill and rate-limit
   * against.
   */
  anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID?.trim() || "",
  openaiDefaultModel: optional("OPENAI_DEFAULT_MODEL", "gpt-4o"),

  databaseProvider: optional("DATABASE_PROVIDER", "postgresql") as
    | "postgresql"
    | "sqlite",
  embeddingProvider: optional("EMBEDDING_PROVIDER", "local") as "local" | "openai",
  storageDir: optional("STORAGE_DIR", "./storage"),

  appUrl: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "",

  /**
   * Webhook URLs notified when a conversation escalates or a critical issue is
   * logged. Comma-separated, so one deployment can post to a Slack channel and
   * an email relay at once. Empty disables notifications entirely.
   */
  get notifyWebhooks(): string[] {
    return (process.env.NOTIFY_WEBHOOK_URLS ?? process.env.SLACK_WEBHOOK_URL ?? "")
      .split(",")
      .map((url) => url.trim())
      .filter((url) => /^https?:\/\//.test(url));
  },

  chatRateLimit: int("CHAT_RATE_LIMIT", 20),
  chatRateLimitWindowMs: int("CHAT_RATE_LIMIT_WINDOW_MS", 60_000),

  /** Max accepted upload size for a single context document. */
  maxUploadBytes: 20 * 1024 * 1024,
} as const;

export const usesPgVector = env.databaseProvider === "postgresql";
