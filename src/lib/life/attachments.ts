/**
 * Something the person sends their assistant: a photo, a PDF, a statement, a
 * document. One pipeline for the web chat and LINE, so both behave the same:
 *  - a photo is looked at and remembered; slips and bills go to the ledger;
 *  - a CSV statement goes to the ledger;
 *  - a PDF that is a bill goes to the ledger, any other document is kept in
 *    the assistant's files so it can read it later.
 * Nothing is read in the background: only what the person chose to send.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { safeFilename, storage } from "@/lib/platform/storage";
import { ingestDocument } from "@/lib/rag/ingest";
import { ACCEPTED_EXTENSIONS } from "@/lib/rag/extract-shared";
import { describePhoto, nextSteps } from "./photo";
import { importFiles } from "./slips";
import * as store from "./store";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const IMAGES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const ext = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "");

export const ATTACHMENT_HELP = "I can read photos, PDFs, Word documents, text files and CSV statements.";

export interface Attachment {
  name: string;
  type: string;
  data: Buffer;
}

export interface AttachmentReply {
  text: string;
  /** One-tap replies worth offering next. */
  nextSteps?: string[];
}

export function attachmentSupported(name: string): boolean {
  const e = ext(name);
  return e in IMAGES || (ACCEPTED_EXTENSIONS as readonly string[]).includes(e);
}

/** Keeps a document in the assistant's files, so "summarise it" and later questions can find it. */
async function keep(agentId: string, file: Attachment): Promise<void> {
  const stored = await storage.put(`agents/${agentId}`, file.name, file.data);
  const document = await prisma.document.create({
    data: { agentId, filename: safeFilename(file.name), mimeType: file.type || "application/octet-stream", storageKey: stored.storageKey, sizeBytes: stored.sizeBytes, status: "pending" },
  });
  await ingestDocument(document.id);
}

export async function receiveAttachment(
  space: { organizationId: string; projectId: string },
  agentId: string | null,
  file: Attachment,
): Promise<AttachmentReply> {
  if (!attachmentSupported(file.name)) return { text: ATTACHMENT_HELP };
  if (file.data.byteLength === 0) return { text: "That file is empty." };
  if (file.data.byteLength > MAX_ATTACHMENT_BYTES) return { text: "That file is too big. The limit is 10 MB." };
  const actor = { ...space, source: "chat" };
  const e = ext(file.name);

  const ledger = async (name = file.name) => (await importFiles(space, [{ name, type: file.type, data: file.data }]))[0];
  const ledgerText = (r: Awaited<ReturnType<typeof ledger>>) =>
    r?.duplicates ? "I already have that one." : 'Added to your money. Say "budget" to see where you stand.';

  if (e in IMAGES) {
    const photo = await describePhoto(space.organizationId, { mediaType: IMAGES[e]!, data: file.data.toString("base64") });
    if (!photo) return { text: "I couldn't make out that photo. Try a clearer one, or tell me what it is." };
    if (photo.kind === "slip" || photo.kind === "bill") {
      const r = await ledger(`slip${e}`);
      if (r && !r.error) return { text: `${ledgerText(r)} (${photo.kind})` };
    }
    await store.addNote(actor, `Photo they sent: ${photo.summary}`);
    return { text: photo.summary, nextSteps: nextSteps(photo.kind) };
  }

  if (e === ".csv") {
    const r = await ledger();
    return { text: r?.error ? `I couldn't read that: ${r.error}` : ledgerText(r) };
  }

  // A PDF may be a bill; try the ledger first and fall back to keeping it as a document.
  if (e === ".pdf") {
    const r = await ledger();
    if (r && !r.error) return { text: ledgerText(r) };
  }
  if (!agentId) return { text: "Switch your assistant on first, then I can keep files for it." };
  await keep(agentId, file);
  await store.addNote(actor, `File they sent: ${file.name}`);
  return { text: `Saved ${file.name}. I can read it whenever you ask.`, nextSteps: ["Summarise it", "Never mind"] };
}
