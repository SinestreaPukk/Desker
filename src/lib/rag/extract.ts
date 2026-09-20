/**
 * Text extraction from uploaded context documents.
 *
 * Accepts exactly the formats the builder advertises. Anything else is rejected
 * at upload time rather than silently producing an empty document.
 */
import "server-only";
import { normalizeText } from "./chunk";
import { ACCEPTED_EXTENSIONS } from "./extract-shared";

export { ACCEPTED_EXTENSIONS };

export const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
  "text/markdown": [".md", ".markdown"],
} as const;


export class UnsupportedDocumentError extends Error {}
export class EmptyDocumentError extends Error {}

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

/**
 * Browsers report inconsistent MIME types (markdown often arrives as
 * application/octet-stream), so the extension is the tiebreaker.
 */
export function isAcceptedUpload(filename: string, mimeType: string): boolean {
  const extension = extensionOf(filename);
  return (
    (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension) ||
    Object.keys(ACCEPTED_TYPES).includes(mimeType)
  );
}

export async function extractText(
  data: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const extension = extensionOf(filename);

  let raw: string;
  if (extension === ".pdf" || mimeType === "application/pdf") {
    // Import the library entry point directly: pdf-parse's index.js runs a
    // self-test against a bundled sample file when it thinks it is the main
    // module, which breaks under a bundler.
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(data);
    raw = parsed.text;
  } else if (
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: data });
    raw = result.value;
  } else if (
    [".txt", ".md", ".markdown"].includes(extension) ||
    mimeType.startsWith("text/")
  ) {
    raw = data.toString("utf8");
  } else {
    throw new UnsupportedDocumentError(
      `Cannot read "${filename}". Supported formats: PDF, DOCX, TXT, MD.`,
    );
  }

  const text = normalizeText(raw);
  if (!text) {
    throw new EmptyDocumentError(
      `No readable text found in "${filename}". Scanned PDFs need OCR before upload.`,
    );
  }
  return text;
}
