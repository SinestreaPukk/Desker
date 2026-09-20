import { describe, expect, it } from "vitest";
import { bm25Rank, reciprocalRankFusion } from "@/lib/rag/bm25";
import {
  cosineSimilarity,
  localEmbed,
  tokenize,
  EMBEDDING_DIMENSIONS,
} from "@/lib/rag/embeddings";

const DOCS = [
  {
    id: "returns",
    content:
      "Unused items may be returned within 30 days of delivery for a full refund. " +
      "Items returned between 31 and 60 days receive store credit only.",
  },
  {
    id: "warranty",
    content:
      "Power tools carry a 24-month manufacturer warranty. Hand tools carry a " +
      "lifetime warranty against manufacturing defects.",
  },
  {
    id: "shipping",
    content:
      "Return shipping is free for faulty items. For change-of-mind returns the " +
      "customer pays return postage at a flat rate.",
  },
];

describe("tokenize", () => {
  it("lowercases, strips punctuation and drops single characters", () => {
    expect(tokenize("Refunds: 5 business days, a full refund!")).toEqual([
      "refunds",
      "business",
      "days",
      "full",
      "refund",
    ]);
  });

  it("keeps non-latin scripts", () => {
    expect(tokenize("返品 policy")).toEqual(["返品", "policy"]);
  });
});

describe("bm25Rank", () => {
  it("ranks the document that actually answers the query first", () => {
    expect(bm25Rank("warranty on power tools", DOCS)[0]?.id).toBe("warranty");
    expect(bm25Rank("store credit after 30 days", DOCS)[0]?.id).toBe("returns");
  });

  it("returns nothing for a query with no content words in common", () => {
    expect(bm25Rank("kubernetes ingress controller", DOCS)).toEqual([]);
    expect(bm25Rank("photosynthesis chlorophyll", DOCS)).toEqual([]);
  });

  it("does not match on stopwords alone", () => {
    // "of", "the", "for" all appear in the corpus. A query made only of them
    // must not surface anything, or an unrelated question gets a confident
    // answer from whichever chunk happened to rank first.
    expect(bm25Rank("of the for", DOCS)).toEqual([]);
    expect(bm25Rank("what is the capital city of France", DOCS)).toEqual([]);
  });

  it("handles an empty query and an empty corpus", () => {
    expect(bm25Rank("", DOCS)).toEqual([]);
    expect(bm25Rank("returns", [])).toEqual([]);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards a document both rankings found over one only a single ranking found", () => {
    // This is the property the hybrid retriever relies on: a chunk that the
    // keyword half and the vector half both surface should outrank one that
    // only appeared in a single half.
    const fused = reciprocalRankFusion([
      [{ id: "both" }, { id: "keyword-only" }],
      [{ id: "both" }, { id: "vector-only" }],
    ]);
    expect(fused.get("both")!).toBeGreaterThan(fused.get("keyword-only")!);
    expect(fused.get("both")!).toBeGreaterThan(fused.get("vector-only")!);
  });

  it("prefers a better rank when two documents appear in the same rankings", () => {
    const fused = reciprocalRankFusion([
      [{ id: "first" }, { id: "second" }],
      [{ id: "first" }, { id: "second" }],
    ]);
    expect(fused.get("first")!).toBeGreaterThan(fused.get("second")!);
  });

  it("scores a single-ranking hit by its rank alone", () => {
    const fused = reciprocalRankFusion([[{ id: "x" }, { id: "y" }]]);
    expect(fused.get("x")!).toBeGreaterThan(fused.get("y")!);
  });

  it("returns an empty map when there is nothing to fuse", () => {
    expect(reciprocalRankFusion([]).size).toBe(0);
    expect(reciprocalRankFusion([[], []]).size).toBe(0);
  });
});

describe("localEmbed", () => {
  it("produces a vector matching the pgvector column width", () => {
    expect(localEmbed("return policy")).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("is deterministic", () => {
    expect(localEmbed("return policy")).toEqual(localEmbed("return policy"));
  });

  it("is L2-normalised, so cosine similarity is a plain dot product", () => {
    const vector = localEmbed("returns and refunds within 30 days");
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 6);
  });

  it("returns a zero vector for text with no usable tokens", () => {
    const vector = localEmbed("!! ?? .");
    expect(vector.every((value) => value === 0)).toBe(true);
  });

  it("scores identical text higher than unrelated text", () => {
    const query = localEmbed("warranty on power tools");
    const related = cosineSimilarity(query, localEmbed(DOCS[1]!.content));
    const unrelated = cosineSimilarity(query, localEmbed("sourdough bread recipe"));
    expect(related).toBeGreaterThan(unrelated);
  });
});
