/**
 * An error a route turns into an HTTP response. Its own module so domain code
 * (lib/work) can throw one without importing the route helpers,
 * which pull in auth and Next's server runtime.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
