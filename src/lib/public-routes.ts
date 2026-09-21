/**
 * The pages a stranger sees before signing in.
 *
 * These render in the light theme only. The landing page is a designed
 * picture - a morning sky with the product floating over the horizon - and
 * the same artwork on a near-black ground is a different, worse picture, not
 * a dark variant of this one. The product behind the login keeps all three
 * theme choices; this list is only the shop window.
 */
const PUBLIC_PATHS = new Set(["/", "/contact", "/privacy", "/terms", "/showcase"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}
