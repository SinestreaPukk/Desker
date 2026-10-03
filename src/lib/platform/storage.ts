/**
 * File storage for uploaded documents, on local disk.
 *
 * Nothing outside this module may assume uploads live on a disk: callers go
 * through `storage` and keep only the opaque key it returns.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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

function resolveKey(storageKey: string): string {
  // The storage root is operator-configurable, so this path cannot be
  // statically analysed. Nothing is bundled from it - it is read at runtime.
  const root = resolve(/* turbopackIgnore: true */ process.cwd(), env.storageDir);
  const target = resolve(root, storageKey);
  // Defence in depth: a crafted key must never escape the storage root.
  if (target !== root && !target.startsWith(root + "/")) {
    throw new Error("Invalid storage key");
  }
  return target;
}

// ponytail: local disk only; a multi-instance deploy needs an S3-backed version of these three.
export const storage = {
  async put(namespace: string, filename: string, data: Buffer): Promise<StoredFile> {
    const storageKey = join(namespace, `${randomUUID()}-${safeFilename(filename)}`);
    const target = resolveKey(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return {
      storageKey,
      sizeBytes: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  },

  async get(storageKey: string): Promise<Buffer> {
    return readFile(resolveKey(storageKey));
  },

  async delete(storageKey: string): Promise<void> {
    await unlink(resolveKey(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  },
};
