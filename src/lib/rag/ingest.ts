/**
 * Document ingestion pipeline: extract -> chunk -> embed -> persist.
 *
 * Runs after the upload response has been sent. A Document row moves
 * pending -> ready | failed, and the builder UI polls that status, so an
 * ingestion failure surfaces in the UI instead of vanishing.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { chunkText } from "./chunk";
import { embedBatch } from "./embeddings";
import { extractText } from "./extract";
import { syncVectorColumn } from "./retriever";

export async function ingestDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return;

  try {
    const data = await getStorage().get(document.storageKey);
    const text = await extractText(data, document.filename, document.mimeType);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("Document produced no chunks after extraction.");
    }

    const embeddings = await embedBatch(chunks);

    // Re-ingestion replaces the previous chunk set rather than duplicating it.
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    const created = await prisma.$transaction(
      chunks.map((content, index) =>
        prisma.documentChunk.create({
          data: {
            documentId,
            agentId: document.agentId,
            content,
            chunkIndex: index,
            embeddingJson: JSON.stringify(embeddings[index] ?? []),
          },
          select: { id: true },
        }),
      ),
    );

    // Mirror into the pgvector column (no-op on SQLite).
    for (let i = 0; i < created.length; i++) {
      await syncVectorColumn(created[i]!.id, embeddings[i] ?? []);
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ready", chunkCount: chunks.length, error: null },
    });
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Ingestion failed.",
      },
    });
  }
}
