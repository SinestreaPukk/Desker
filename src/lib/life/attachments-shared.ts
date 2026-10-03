import { ACCEPTED_EXTENSIONS } from "@/lib/rag/extract-shared";

/** What the chat's file picker offers: photos and the documents the assistant can read. */
export const ATTACHMENT_ACCEPT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ...ACCEPTED_EXTENSIONS].join(",");
