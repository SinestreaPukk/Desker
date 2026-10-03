/**
 * Strips secrets from anything leaving for error monitoring: reset-link and
 * OAuth tokens in addresses, bearer tokens, API keys and signing secrets in
 * messages. Error reports already carry no request bodies or headers; this
 * covers what's left - the URL, the error text, the breadcrumbs.
 *
 * Pure: the server and browser Sentry setups share it, and a test holds it.
 */

/** Query parameters that are credentials whatever the page. */
const SECRET_PARAMS = /^(token|code|state|password|passcode|secret|key|api_key|apikey|access_token|refresh_token|id_token|client_secret|signature|sig|session|sessionid)$/i;

/** Recognisable credential shapes, wherever they appear in text. */
const SECRET_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}/g, // Stripe
  /\bwhsec_[A-Za-z0-9]{8,}/g, // Stripe webhook secrets
  /\bsk-(ant-)?[A-Za-z0-9_-]{16,}/g, // Anthropic, OpenAI
  /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}/g, // GitHub
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bre_[A-Za-z0-9]{16,}/g, // Resend
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWTs
  /\b(postgres(ql)?|mysql):\/\/[^\s"']+/gi, // database URLs with their passwords
];

const REDACTED = "[redacted]";

export function scrubText(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
  return out.replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g, (match, sep: string, name: string) =>
    SECRET_PARAMS.test(name) ? `${sep}${name}=${REDACTED}` : match,
  );
}

/** A whole report, deep: every string in it scrubbed. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) return value;
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_PARAMS.test(key) || /authorization|cookie|password|secret/i.test(key) ? REDACTED : scrubDeep(item, depth + 1);
    }
    return out as T;
  }
  return value;
}
