import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

const noteSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000),
});

export interface NoteDto {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { conversationId } = await params;

    const notes = await prisma.conversationNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return notes.map(
      (note): NoteDto => ({
        id: note.id,
        authorName: note.authorName,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
      }),
    );
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireAdmin();
    const { conversationId } = await params;
    const input = await parseJson(request, noteSchema);

    const exists = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "That conversation no longer exists.");

    const note = await prisma.conversationNote.create({
      data: {
        conversationId,
        authorName: session.email.split("@")[0] || "admin",
        body: input.body,
      },
    });

    const dto: NoteDto = {
      id: note.id,
      authorName: note.authorName,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    };
    return dto;
  });
}
