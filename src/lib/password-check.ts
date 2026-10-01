/**
 * Refuses passwords that are already public: ones found in data breaches
 * (Have I Been Pwned's Pwned Passwords), and the account's own email. The
 * check is k-anonymous - only the first five characters of the password's
 * SHA-1 leave the server, never the password or its full hash - and it fails
 * open: if the service can't be reached, the password is judged on length
 * alone rather than locking someone out of signing up.
 */
import "server-only";
import { createHash } from "node:crypto";

const RANGE = "https://api.pwnedpasswords.com/range/";

/** True when the password appears in a known breach. False when it doesn't, or the check couldn't run. */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetch(`${RANGE}${prefix}`, {
      // Padding hides how many matches the prefix has from anyone watching.
      headers: { "Add-Padding": "true", "user-agent": "Desker" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/** The reason a new password is refused, or null when it is fine. */
export async function passwordProblem(password: string, email?: string): Promise<string | null> {
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (email && (password.toLowerCase() === email.toLowerCase() || (local.length >= 4 && password.toLowerCase().includes(local)))) {
    return "Choose a password that doesn't contain your email address.";
  }
  if (await isBreachedPassword(password)) {
    return "That password has appeared in a data breach, so attackers try it first. Choose a different one.";
  }
  return null;
}
