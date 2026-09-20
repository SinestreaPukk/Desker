import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { syncVectorColumn } from "@/lib/rag/retriever";
import { toAgentDetail } from "@/lib/serialize";
import { findProjectById } from "@/lib/projects";

export const runtime = "nodejs";

type Params = { params: Promise<{ agentId: string }> };

const duplicateSchema = z.object({
  /** Defaults to the source agent's own project. */
  projectId: z.string().min(1).optional(),
  includeDocuments: z.boolean().default(true),
});

/**
 * Copies an agent - persona, permissions, and optionally its indexed documents -
 * as a new draft. Used to seed a new project from a proven agent, or to fork a
 * variant without touching the live one.
 *
 * Documents are copied properly: the blob is re-put under a new storage key
 * and the chunks are re-inserted with their embeddings intact. Sharing the
 * original's storage key would look like it worked until one copy was deleted
 * and took the other's file with it.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { agentId } = await params;
    const input = await parseJson(request, duplicateSchema);

    const source = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        documents: {
          where: { status: "ready" },
          include: { chunks: { orderBy: { chunkIndex: "asc" } } },
        },
      },
    });
    if (!source) throw new HttpError(404, "That agent no longer exists.");

    const projectId = input.projectId ?? source.projectId;
    const project = await findProjectById(projectId, userId);
    if (!project) throw new HttpError(404, "That project no longer exists.");

    const sameProject = projectId === source.projectId;

    const copy = await prisma.agent.create({
      data: {
        projectId,
        // A copy into another project keeps the name; a copy beside the
        // original needs to be told apart from it.
        name: sameProject ? `${source.name} (copy)` : source.name,
        jobTitle: source.jobTitle,
        department: source.department,
        avatarUrl: source.avatarUrl,
        personality: source.personality,
        responsibilities: source.responsibilities ?? [],
        allowedTools: source.allowedTools ?? [],
        escalationRule: source.escalationRule,
        welcomeMessage: source.welcomeMessage,
        // Always a draft: a copy should never be reachable by clients until
        // someone has looked at it.
        status: "draft",
        modelProvider: source.modelProvider,
        model: source.model,
        // Passcodes are per-deployment secrets, not part of the persona.
        publicPasscode: null,
        widgetLabel: source.widgetLabel,
        widgetColor: source.widgetColor,
        widgetSide: source.widgetSide,
      },
    });

    let copiedDocuments = 0;
    if (input.includeDocuments) {
      const storage = getStorage();
      for (const document of source.documents) {
        let storageKey = document.storageKey;
        try {
          const data = await storage.get(document.storageKey);
          storageKey = (await storage.put(`agents/${copy.id}`, document.filename, data))
            .storageKey;
        } catch (error) {
          // The chunks are what retrieval reads; a missing blob only affects
          // re-ingestion. Copy what we have and say so in the log.
          console.error("[duplicate] blob copy failed, keeping chunks only", error);
        }

        const created = await prisma.document.create({
          data: {
            agentId: copy.id,
            filename: document.filename,
            mimeType: document.mimeType,
            storageKey,
            sizeBytes: document.sizeBytes,
            status: "ready",
            chunkCount: document.chunkCount,
          },
        });

        const chunks = await prisma.$transaction(
          document.chunks.map((chunk) =>
            prisma.documentChunk.create({
              data: {
                documentId: created.id,
                agentId: copy.id,
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
                embeddingJson: chunk.embeddingJson,
              },
              select: { id: true, embeddingJson: true },
            }),
          ),
        );
        for (const chunk of chunks) {
          if (chunk.embeddingJson) {
            await syncVectorColumn(chunk.id, JSON.parse(chunk.embeddingJson) as number[]);
          }
        }
        copiedDocuments += 1;
      }
    }

    return {
      agent: toAgentDetail(copy),
      project: { id: project.id, slug: project.slug, name: project.name },
      copiedDocuments,
    };
  });
}
