/**
 * The pages a stranger sees before signing in.
 *
 * These render in the light theme only. The landing page is a designed
 * picture - a morning sky with the product floating over the horizon - and
 * the same artwork on a near-black ground is a different, worse picture, not
 * a dark variant of this one. The product behind the login keeps all three
 * theme choices; this list is only the shop window.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/beta",
  "/contact",
  "/privacy",
  "/terms",
  "/showcase",
  "/guides",
]);

/**
 * The sign-up and sign-in pages are the last step of the same walk, reached
 * from every call to action on the landing page, so they render light too -
 * a visitor who came in through a bright morning should not have the lights
 * go out at the moment they are asked for an email. The theme they chose is
 * waiting on the other side of the form. /invite is here for the same reason:
 * it is a stranger's front door.
 */
const PUBLIC_PREFIXES = ["/invite/", "/guides/"];

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/unsubscribe"
  ) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

