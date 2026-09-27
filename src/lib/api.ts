/**
 * Shared helpers for route handlers: auth gate, error shape, JSON parsing.
 *
 * Every admin endpoint funnels through `requireAdmin`, so authorisation is one
 * reviewable line per route rather than a pattern each route reimplements.
 */
import "server-only";
import { HttpError } from "@/lib/http-error";
import { OrganizationRateLimited } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { currentUser } from "@/lib/auth";
import { Forbidden } from "@/lib/organizations";
import { captureError } from "@/lib/monitoring";

export { HttpError };

interface AdminSession {
  userId: string;
  email: string;
}

/** Throws 401 unless a valid admin session is present. */
export async function requireAdmin(): Promise<AdminSession> {
  const user = await currentUser();
  if (!user) {
    throw new HttpError(401, "You need to be signed in to do that.");
  }
  return { userId: user.id, email: user.email };
}

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, ...(details ? { details } : {}) }, { status });
}

/**
 * Wraps a handler so thrown HttpErrors and Zod failures become clean JSON
 * instead of a 500 with a stack trace.
 */
export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.status, error.message, error.details);
    }
    if (error instanceof OrganizationRateLimited) {
      const response = jsonError(429, error.message);
      response.headers.set("retry-after", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof Forbidden) {
      return jsonError(403, error.message);
    }
    if (error instanceof ZodError) {
      // The per-field messages say what to fix; this line says where to look.
      return jsonError(422, "Check the highlighted fields and try again.", {
        fieldErrors: error.flatten().fieldErrors,
      });
    }
    captureError(error, { route: "api" });
    return jsonError(500, "Something went wrong on our end. Please try again.");
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "That request could not be read. Reload the page and try again.");
  }
  return schema.parse(body);
}
