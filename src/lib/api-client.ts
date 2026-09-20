/**
 * Browser-side fetch wrapper.
 *
 * Turns the API's `{ error, details }` envelope into a thrown ApiError carrying
 * the human-readable message, so every TanStack Query error state can render
 * something a person can act on instead of "Failed to fetch".
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as
      | { error?: string; details?: { fieldErrors?: Record<string, string[]> } }
      | null;
    throw new ApiError(
      response.status,
      body?.error ?? `Request failed (${response.status}).`,
      body?.details?.fieldErrors,
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
