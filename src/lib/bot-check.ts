/**
 * Two quiet checks on the public forms (sign-up, the beta list, contact),
 * on top of their per-address rate limits, with nothing for a person to
 * solve:
 *
 * - a field people never see, which form-filling bots fill in;
 * - the time since the form appeared, which a script doesn't spend.
 *
 * Pure: the forms and the routes share the names.
 */
export const TRAP_FIELD = "website";
export const STARTED_FIELD = "startedAt";
/** Nobody fills in and sends one of these forms faster than this. */
export const MIN_FILL_MS = 1000;

export function looksAutomated(body: unknown, now = Date.now()): boolean {
  const fields = (body ?? {}) as Record<string, unknown>;
  const trap = fields[TRAP_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") return true;
  const started = Number(fields[STARTED_FIELD]);
  // Missing, in the future, or a day old: not a form a person just filled in.
  if (!Number.isFinite(started) || started > now || now - started > 86_400_000) return true;
  return now - started < MIN_FILL_MS;
}

/** Reads the JSON body without using it up, for a route that parses it again afterwards. */
export async function requestLooksAutomated(request: Request): Promise<boolean> {
  return looksAutomated(await request.clone().json().catch(() => null));
}
