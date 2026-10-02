import { describe, expect, it, vi, beforeEach } from "vitest";
import { TOOL_DEFINITIONS, TOOL_IDS, isToolId, toolDefinitionsFor } from "@/lib/tools/registry";

// The executor writes to the database, so the client is faked. What is under
// test is argument validation and permission enforcement, not Prisma.
const retrievalLogs: Record<string, unknown>[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    retrievalLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        retrievalLogs.push(data);
        return { id: "log_1", ...data };
      }),
    },
  },
}));
vi.mock("@/lib/rag/retriever", () => ({
  retrieveContext: vi.fn(async (_agentId: string, query: string) =>
    query.includes("nothing")
      ? []
      : [
          {
            id: "c1",
            documentId: "d1",
            filename: "returns.md",
            chunkIndex: 0,
            content: "Returns accepted within 30 days.",
            score: 0.9,
          },
        ],
  ),
}));

const { executeToolCall } = await import("@/lib/tools/execute");

const context = { agentId: "agent_1", conversationId: "conv_1" };
const ALL = [...TOOL_IDS];

beforeEach(() => {
  retrievalLogs.length = 0;
});

describe("tool registry", () => {
  it("defines every advertised tool", () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_DEFINITIONS[id].name).toBe(id);
      expect(TOOL_DEFINITIONS[id].description.length).toBeGreaterThan(40);
      expect(TOOL_DEFINITIONS[id].inputSchema.type).toBe("object");
      expect(TOOL_DEFINITIONS[id].inputSchema.additionalProperties).toBe(false);
    }
  });

  it("resolves only known ids", () => {
    expect(isToolId("search_documents")).toBe(true);
    expect(isToolId("log_issue")).toBe(false);
    expect(toolDefinitionsFor(["search_documents", "nope"])).toHaveLength(1);
  });
});

describe("executeToolCall", () => {
  it("refuses a tool the agent was not granted", async () => {
    const result = await executeToolCall({ id: "t1", name: "search_documents", input: { query: "x" } }, context, []);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("not permitted");
  });

  it("refuses a hallucinated tool name", async () => {
    const result = await executeToolCall({ id: "t1", name: "delete_everything", input: {} }, context, ALL);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });

  it("returns retrieved passages with their source filenames", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "search_documents", input: { query: "returns" } },
      context,
      ALL,
    );
    expect(result.content).toContain("returns.md");
    expect(result.content).toContain("Returns accepted within 30 days.");
    expect(result.effect).toMatchObject({ kind: "search", hits: 1 });
  });

  it("tells the agent to admit ignorance when retrieval finds nothing", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "search_documents", input: { query: "nothing here" } },
      context,
      ALL,
    );
    expect(result.content).toMatch(/rather than guessing/i);
    expect(result.effect).toMatchObject({ hits: 0 });
  });

  it("records every search, so the misses can be reviewed later", async () => {
    await executeToolCall(
      { id: "t1", name: "search_documents", input: { query: "returns" } },
      context,
      ALL,
    );
    await executeToolCall(
      { id: "t2", name: "search_documents", input: { query: "nothing here" } },
      context,
      ALL,
    );

    expect(retrievalLogs).toHaveLength(2);
    // The miss is the useful half: it is a question the documents cannot answer.
    expect(retrievalLogs[1]).toMatchObject({ query: "nothing here", hitCount: 0 });
    expect(retrievalLogs[0]).toMatchObject({ hitCount: 1 });
  });
});
