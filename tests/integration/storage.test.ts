import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

describe("file storage in the database", () => {
  it("keeps the exact bytes, and forgets them on delete", async () => {
    const { storage } = await import("@/lib/platform/storage");
    const bytes = Buffer.from([0, 255, 1, 2, 3, 254, 10, 13]);
    const stored = await storage.put("test", "../evil name.bin", bytes);
    expect(stored.storageKey).not.toContain("..");
    expect(Buffer.compare(await storage.get(stored.storageKey), bytes)).toBe(0);
    await storage.delete(stored.storageKey);
    expect(await prisma.storedBlob.count({ where: { key: stored.storageKey } })).toBe(0);
  });
});
