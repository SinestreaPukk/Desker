/**
 * File storage seam.
 *
 * Nothing outside this module may assume uploaded documents live on a disk.
 * The local driver is what the MVP ships with; the S3 driver is the shape a
 * production deployment drops in, and is intentionally left unimplemented
 * rather than half-implemented so it cannot be mistaken for working code.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { env } from "@/lib/env";

export interface StoredFile {
  /** Opaque handle. Only the driver that produced it knows how to read it. */
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface StorageDriver {
  readonly id: string;
  put(namespace: string, filename: string, data: Buffer): Promise<StoredFile>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

/** Strips path separators and traversal from an untrusted upload filename. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").trim();
  return cleaned.slice(0, 180) || "file";
}

class LocalDiskStorage implements StorageDriver {
  readonly id = "local";

  private get root(): string {
    // The storage root is operator-configurable, so this path cannot be
    // statically analysed. Nothing is bundled from it - it is read at runtime.
    return resolve(/* turbopackIgnore: true */ process.cwd(), env.storageDir);
  }

  private resolveKey(storageKey: string): string {
    const target = resolve(this.root, storageKey);
    // Defence in depth: a crafted key must never escape the storage root.
    if (target !== this.root && !target.startsWith(this.root + "/")) {
      throw new Error("Invalid storage key");
    }
    return target;
  }

  async put(namespace: string, filename: string, data: Buffer): Promise<StoredFile> {
    const storageKey = join(namespace, `${randomUUID()}-${safeFilename(filename)}`);
    const target = this.resolveKey(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return {
      storageKey,
      sizeBytes: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(this.resolveKey(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

/**
 * Placeholder for an S3-compatible driver (S3, R2, MinIO, Spaces).
 *
 * Implementing this is the entire cost of moving off local disk - the rest of
 * the app already talks to the interface above. Left throwing on purpose: a
 * driver that silently no-ops is worse than one that is obviously absent.
 */
class S3CompatibleStorage implements StorageDriver {
  readonly id = "s3";
  private unimplemented(): never {
    throw new Error(
      "S3-compatible storage driver is not implemented. Set STORAGE_DRIVER=local, " +
        "or implement put/get/delete in lib/storage.ts using @aws-sdk/client-s3.",
    );
  }
  async put(): Promise<StoredFile> {
    this.unimplemented();
  }
  async get(): Promise<Buffer> {
    this.unimplemented();
  }
  async delete(): Promise<void> {
    this.unimplemented();
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!driver) {
    driver =
      process.env.STORAGE_DRIVER === "s3"
        ? new S3CompatibleStorage()
        : new LocalDiskStorage();
  }
  return driver;
}
