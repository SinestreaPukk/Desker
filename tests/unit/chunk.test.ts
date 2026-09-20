import { describe, expect, it } from "vitest";
import {
  chunkText,
  normalizeText,
  DEFAULT_CHUNK_OPTIONS,
} from "@/lib/rag/chunk";

describe("normalizeText", () => {
  it("collapses the whitespace noise PDF extraction leaves behind", () => {
    expect(normalizeText("a  \t b\r\nc\n\n\n\nd  ")).toBe("a b\nc\n\nd");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeText("   \n\n \t ")).toBe("");
  });
});

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("keeps a short document as a single chunk", () => {
    const text = "One short paragraph about returns.";
    expect(chunkText(text)).toEqual([text]);
  });

  it("splits a long document and respects the size cap", () => {
    const paragraph = "Sentence about the return policy. ".repeat(20);
    const text = Array.from({ length: 12 }, () => paragraph).join("\n\n");

    const chunks = chunkText(text, { maxChars: 500, overlapChars: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    // The cap is a target: overlap plus one indivisible unit can exceed it, but
    // never by more than that unit.
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(500 + paragraph.length);
    }
  });

  it("overlaps consecutive chunks so a boundary-straddling answer survives", () => {
    const text = Array.from(
      { length: 10 },
      (_, index) => `Paragraph ${index} with enough words to matter here.`,
    ).join("\n\n");

    const chunks = chunkText(text, { maxChars: 120, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(2);

    // Every chunk after the first repeats a tail of its predecessor.
    for (let i = 1; i < chunks.length; i++) {
      const head = chunks[i]!.slice(0, 30);
      expect(chunks[i - 1]!.includes(head.split("\n")[0]!.trim())).toBe(true);
    }
  });

  it("breaks up a single paragraph that alone exceeds the cap", () => {
    const giant = "word ".repeat(2000);
    const chunks = chunkText(giant, { maxChars: 300, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(5);
  });

  it("breaks up a single sentence with no punctuation to split on", () => {
    const runOn = "a".repeat(5000);
    const chunks = chunkText(runOn, { maxChars: 400, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(12);
    expect(chunks.join("").length).toBeGreaterThanOrEqual(4000);
  });

  it("folds a runt trailing chunk into its predecessor", () => {
    const text = `${"Long paragraph text here. ".repeat(30)}\n\nTiny.`;
    const chunks = chunkText(text, { maxChars: 400, overlapChars: 20, minChars: 80 });
    expect(chunks[chunks.length - 1]).toContain("Tiny.");
    expect(chunks[chunks.length - 1]!.length).toBeGreaterThanOrEqual(80);
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_CHUNK_OPTIONS.overlapChars).toBeLessThan(
      DEFAULT_CHUNK_OPTIONS.maxChars,
    );
  });
});
