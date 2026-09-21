/**
 * Product analytics, first-party and minimal: one row per thing a person
 * did. The point is to learn what the first customers actually use and where
 * they stop, so the next phase is built on evidence. Never throws.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function track(event: {
  name: string;
  organizationId?: string | null;
  userId?: string | null;
  path?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.productEvent.create({
      data: {
        name: event.name,
        organizationId: event.organizationId ?? null,
        userId: event.userId ?? null,
        path: event.path ?? null,
        metadata: event.metadata,
      },
    });
  } catch (error) {
    console.error("[events] not recorded", event.name, error);
  }
}
