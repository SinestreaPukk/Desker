/**
 * Client-side validation that cannot contradict the server.
 *
 * Every form here posts to a route that parses the same zod schema, so the
 * forms check against that schema rather than against a second set of rules
 * written by hand. A field is either wrong in both places or right in both,
 * and the message a person reads is the one the server would have sent -
 * except that it arrives before the round trip instead of after it.
 */
import type { ZodType } from "zod";

type FieldErrors = Record<string, string[]>;

type Validated<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export function validate<T>(schema: ZodType<T>, value: unknown): Validated<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const flattened = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors: FieldErrors = {};
  for (const [key, messages] of Object.entries(flattened)) {
    if (messages && messages.length > 0) fieldErrors[key] = messages;
  }
  // A schema-level refusal (a .refine on the object) has no field to sit
  // under; surface it rather than showing a form that refuses silently.
  const formErrors = result.error.flatten().formErrors;
  if (Object.keys(fieldErrors).length === 0 && formErrors.length > 0) {
    fieldErrors._form = formErrors;
  }
  return { ok: false, fieldErrors };
}

/** One email address, as a person would type it - with or without a display name. */
function isEmailAddress(value: string): boolean {
  const bare = /<([^>]+)>\s*$/.exec(value.trim())?.[1] ?? value.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bare);
}

/**
 * A comma-separated recipient list, returning the entries that are not
 * addresses so the message can name them instead of saying "invalid".
 */
export function badRecipients(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !isEmailAddress(entry));
}

/** Five fields, each of them something cron understands. */
export function looksLikeCron(value: string): boolean {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field) => /^[-*/,0-9A-Za-z]+$/.test(field));
}
