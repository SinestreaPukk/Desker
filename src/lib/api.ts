/**
 * Shared helpers for route handlers: auth gate, error shape, JSON parsing.
 *
 * Every admin endpoint funnels through `requireAdmin`, so authorisation is one
 * reviewable line per route rather than a pattern each route reimplements.
 */
import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { currentUser } from "@/lib/auth";
import { Forbidden } from "@/lib/organizations";
import { captureError } from "@/lib/monitoring";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface AdminSession {
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
    if (error instanceof Forbidden) {
      return jsonError(403, error.message);
    }
    if (error instanceof ZodError) {
      return jsonError(422, "Some fields need attention.", {
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
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return schema.parse(body);
}
