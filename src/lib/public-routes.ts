/**
 * The pages a stranger sees before signing in.
 *
 * These render in the light theme. The landing page is a designed
 * picture - a morning sky with the product floating over the horizon.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/beta",
  "/contact",
  "/privacy",
  "/terms",
  "/guides",
  "/blog",
]);

/**
 * The sign-up and sign-in pages are the last step of the same walk, reached
 * from every call to action on the landing page.
 */
const PUBLIC_PREFIXES = ["/guides/", "/blog/"];

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

