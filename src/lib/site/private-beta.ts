/**
 * While Desker is in private beta, only the addresses in ALLOWED_SIGNIN_EMAILS
 * (comma-separated) may sign in or create an account. Unset means open - local
 * development, tests and self-hosted installs. Checked in auth.ts: at sign-in,
 * on every session, and by the sign-up route.
 *
 * Pure and shared so the sign-in form and the server say the same thing.
 */
export const PRIVATE_BETA_CODE = "private_beta";

export const PRIVATE_BETA_MESSAGE =
  "Desker is in private beta, so sign-in is limited to our testers for now. Beta testing opens soon.";

export function mayUsePlatform(email: string, allowlist: string | undefined = process.env.ALLOWED_SIGNIN_EMAILS): boolean {
  const allowed = (allowlist ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.trim().toLowerCase());
}
