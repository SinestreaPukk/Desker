import { describe, expect, it } from "vitest";
import { attachmentSupported } from "@/lib/life/attachments";

describe("attachments", () => {
  it("accepts photos and readable documents, nothing else", () => {
    for (const name of ["slip.JPG", "menu.png", "bill.pdf", "notes.docx", "plan.md", "statement.csv", "a.txt"]) expect(attachmentSupported(name)).toBe(true);
    for (const name of ["clip.mp4", "voice.m4a", "photo.heic", "archive.zip", "noextension"]) expect(attachmentSupported(name)).toBe(false);
  });
});
