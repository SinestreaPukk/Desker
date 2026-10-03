import { prisma } from "@/lib/platform/db";
import { findAgentFor } from "@/lib/tenancy/projects";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { env } from "@/lib/platform/env";
import { safeFilename, storage } from "@/lib/platform/storage";
import { isAcceptedUpload, ACCEPTED_EXTENSIONS } from "@/lib/rag/extract";
import { ingestDocument } from "@/lib/rag/ingest";
import type { DocumentDto } from "@/lib/shared/serialize";
import { formatBytes } from "@/lib/shared/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    if (!(await findAgentFor(agentId, userId))) throw new HttpError(404, "That agent no longer exists.");

    const documents = await prisma.document.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });

    return documents.map(
      (document): DocumentDto => ({
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        error: document.error,
        chunkCount: document.chunkCount,
        createdAt: document.createdAt.toISOString(),
      }),
    );
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    if (!(await findAgentFor(agentId, userId))) throw new HttpError(404, "That agent no longer exists.");

    const form = await request.formData().catch(() => {
      throw new HttpError(400, "Expected a multipart form upload.");
    });
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "No file was included in the upload.");
    }

    // Validate before reading the body into memory.
    if (file.size > env.maxUploadBytes) {
      throw new HttpError(
        413,
        `"${file.name}" is ${formatBytes(file.size)}. The limit is ${formatBytes(env.maxUploadBytes)}.`,
      );
    }
    if (file.size === 0) {
      throw new HttpError(400, `"${file.name}" is empty.`);
    }
    if (!isAcceptedUpload(file.name, file.type)) {
      throw new HttpError(
        415,
        `"${file.name}" is not a supported format. Upload one of: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put(`agents/${agentId}`, file.name, data);

    const document = await prisma.document.create({
      data: {
        agentId,
        filename: safeFilename(file.name),
        mimeType: file.type || "application/octet-stream",
        storageKey: stored.storageKey,
        sizeBytes: stored.sizeBytes,
        status: "pending",
      },
    });

    // Extraction and embedding can take seconds; do not hold the upload open.
    // The client polls document status, so a failure still surfaces in the UI.
    void ingestDocument(document.id);

    const dto: DocumentDto = {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      error: document.error,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt.toISOString(),
    };
    return dto;
  });
}
