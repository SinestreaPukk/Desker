/**
 * File storage for uploads, kept in the database.
 *
 * The host has no writable disk to rely on (Vercel), so the bytes live in a
 * table next to everything else. Nothing outside this module may assume where
 * uploads live: callers go through `storage` and keep only the opaque key it
 * returns. A key written before this (a path on local disk) is still read from
 * disk, so older development data keeps working.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";

interface StoredFile {
  /** Opaque handle. Only this module knows how to read it. */
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

/** Strips path separators and traversal from an untrusted upload filename. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").trim();
  return cleaned.slice(0, 180) || "file";
}

export const storage = {
  async put(namespace: string, filename: string, data: Buffer): Promise<StoredFile> {
    const storageKey = join(namespace, `${randomUUID()}-${safeFilename(filename)}`);
    await prisma.storedBlob.create({ data: { key: storageKey, data: new Uint8Array(data), sizeBytes: data.byteLength } });
    return { storageKey, sizeBytes: data.byteLength, sha256: createHash("sha256").update(data).digest("hex") };
  },

  async get(storageKey: string): Promise<Buffer> {
    const blob = await prisma.storedBlob.findUnique({ where: { key: storageKey }, select: { data: true } });
    if (blob) return Buffer.from(blob.data);
    // Legacy: a file saved to local disk before uploads moved into the database.
    const root = resolve(/* turbopackIgnore: true */ process.cwd(), env.storageDir);
    const target = resolve(root, storageKey);
    if (target !== root && !target.startsWith(root + "/")) throw new Error("Invalid storage key");
    return readFile(target);
  },

  async delete(storageKey: string): Promise<void> {
    await prisma.storedBlob.deleteMany({ where: { key: storageKey } });
  },
};
