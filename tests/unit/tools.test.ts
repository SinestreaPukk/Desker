import { describe, expect, it, vi, beforeEach } from "vitest";
import { TOOL_DEFINITIONS, TOOL_IDS, isToolId, toolDefinitionsFor } from "@/lib/tools/registry";

// The executor writes to the database, so the client is faked. What is under
// test is argument validation and permission enforcement, not Prisma.
const created: Record<string, unknown>[] = [];
const retrievalLogs: Record<string, unknown>[] = [];
const conversationUpdates: Record<string, unknown>[] = [];
const messages: Record<string, unknown>[] = [];

/** Published agents the transfer tool can find. */
const AGENTS: Record<string, { id: string; name: string; jobTitle: string; status: string }> = {
  agent_1: { id: "agent_1", name: "Mia", jobTitle: "Support Lead", status: "published" },
  agent_2: { id: "agent_2", name: "Dana", jobTitle: "Billing Analyst", status: "published" },
  agent_draft: { id: "agent_draft", name: "Noor", jobTitle: "Account Manager", status: "draft" },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: "issue_abc123def", ...data };
      }),
    },
    conversation: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        conversationUpdates.push(data);
        return {};
      }),
    },
    message: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        messages.push(data);
        return { id: "msg_1", ...data };
      }),
    },
    retrievalLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        retrievalLogs.push(data);
        return { id: "log_1", ...data };
      }),
    },
    agent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => AGENTS[where.id] ?? null),
    },
  },
}));
vi.mock("@/lib/events", () => ({ publishAdminEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyInBackground: vi.fn() }));
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
  created.length = 0;
  retrievalLogs.length = 0;
  conversationUpdates.length = 0;
  messages.length = 0;
});

describe("tool registry", () => {
  it("defines every advertised tool", () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_DEFINITIONS[id].name).toBe(id);
      expect(TOOL_DEFINITIONS[id].description.length).toBeGreaterThan(40);
      expect(TOOL_DEFINITIONS[id].inputSchema.type).toBe("object");
    }
  });

  it("marks every schema closed so the model cannot smuggle extra fields", () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_DEFINITIONS[id].inputSchema.additionalProperties).toBe(false);
    }
  });

  it("resolves only known ids", () => {
    expect(isToolId("log_issue")).toBe(true);
    expect(isToolId("rm_rf")).toBe(false);
    expect(toolDefinitionsFor(["log_issue", "nope"])).toHaveLength(1);
  });
});

describe("executeToolCall", () => {
  it("refuses a tool the agent was not granted", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "log_issue", input: { summary: "x", severity: "low", details: "y" } },
      context,
      ["search_company_context"],
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain("not permitted");
    expect(created).toHaveLength(0);
  });

  it("refuses a hallucinated tool name", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "delete_everything", input: {} },
      context,
      ALL,
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });

  it("logs an issue and reports the row back to the model", async () => {
    const result = await executeToolCall(
      {
        id: "t1",
        name: "log_issue",
        input: { summary: "Checkout fails", severity: "high", details: "500 on submit" },
      },
      context,
      ALL,
    );
    expect(result.isError).toBeUndefined();
    expect(created[0]).toMatchObject({
      type: "issue",
      summary: "Checkout fails",
      severity: "high",
      conversationId: "conv_1",
    });
    expect(result.effect).toMatchObject({ kind: "issue", type: "issue" });
  });

  it("rejects a tool call with missing required arguments", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "log_issue", input: {} },
      context,
      ALL,
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Invalid arguments");
    expect(created).toHaveLength(0);
  });

  it("coerces an out-of-range severity instead of failing the turn", async () => {
    const result = await executeToolCall(
      {
        id: "t1",
        name: "log_issue",
        input: { summary: "Odd", severity: "catastrophic", details: "" },
      },
      context,
      ALL,
    );
    expect(result.isError).toBeUndefined();
    expect(created[0]).toMatchObject({ severity: "medium" });
  });

  it("records a suggestion separately from an issue", async () => {
    await executeToolCall(
      { id: "t1", name: "log_suggestion", input: { summary: "Dark mode", details: "eyes" } },
      context,
      ALL,
    );
    expect(created[0]).toMatchObject({ type: "suggestion", summary: "Dark mode" });
  });

  it("escalating flags the conversation and files a high-severity item", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "escalate_to_human", input: { reason: "Client wants a $500 refund." } },
      context,
      ALL,
    );
    expect(result.effect).toMatchObject({ kind: "escalation" });
    // Its own type, so the dashboard can show it as an escalation rather than
    // as an issue with a prefix glued onto the summary.
    expect(created[0]).toMatchObject({ type: "escalation", severity: "high" });
    // The model must not tell the client a human is already reading.
    expect(result.content).toMatch(/do not imply a human is already reading/i);
  });

  it("does not print the escalation reason twice", async () => {
    await executeToolCall(
      {
        id: "t1",
        name: "escalate_to_human",
        input: {
          reason:
            "Client is angry and wants a $450 refund. They asked for a human twice and the amount is above my authority.",
        },
      },
      context,
      ALL,
    );
    const row = created[0] as { summary: string; details: string | null };
    // The inbox renders summary as a headline with details beneath it, so the
    // two must not repeat each other.
    expect(row.summary).toBe("Client is angry and wants a $450 refund.");
    expect(row.details).toBe(
      "They asked for a human twice and the amount is above my authority.",
    );
    expect(row.details).not.toContain(row.summary);
  });

  it("leaves details empty when the escalation reason is a single sentence", async () => {
    await executeToolCall(
      { id: "t1", name: "escalate_to_human", input: { reason: "Client asked for a human." } },
      context,
      ALL,
    );
    const row = created[0] as { summary: string; details: string | null };
    expect(row.summary).toBe("Client asked for a human.");
    expect(row.details).toBeNull();
  });

  it("truncates an escalation reason with no sentence break", async () => {
    const runOn = "client is upset about the delay and ".repeat(12).trim();
    await executeToolCall(
      { id: "t1", name: "escalate_to_human", input: { reason: runOn } },
      context,
      ALL,
    );
    const row = created[0] as { summary: string; details: string | null };
    expect(row.summary.length).toBeLessThanOrEqual(161);
    expect(row.summary.endsWith("…")).toBe(true);
    // The headline is lossy, so the full reason is preserved in the body.
    expect(row.details).toBe(runOn);
  });

  it("returns retrieved passages with their source filenames", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "search_company_context", input: { query: "returns" } },
      context,
      ALL,
    );
    expect(result.content).toContain("returns.md");
    expect(result.content).toContain("Returns accepted within 30 days.");
    expect(result.effect).toMatchObject({ kind: "search", hits: 1 });
  });

  it("tells the agent to admit ignorance when retrieval finds nothing", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "search_company_context", input: { query: "nothing here" } },
      context,
      ALL,
    );
    expect(result.content).toMatch(/rather than guessing/i);
    expect(result.effect).toMatchObject({ hits: 0 });
  });

  it("records every search, so the misses can be reviewed later", async () => {
    await executeToolCall(
      { id: "t1", name: "search_company_context", input: { query: "returns" } },
      context,
      ALL,
    );
    await executeToolCall(
      { id: "t2", name: "search_company_context", input: { query: "nothing here" } },
      context,
      ALL,
    );

    expect(retrievalLogs).toHaveLength(2);
    // The miss is the useful half: it is a question the documents cannot answer.
    expect(retrievalLogs[1]).toMatchObject({ query: "nothing here", hitCount: 0 });
    expect(retrievalLogs[0]).toMatchObject({ hitCount: 1 });
  });
});

describe("transfer_to_agent", () => {
  it("moves the conversation to the colleague without touching its owner", async () => {
    const result = await executeToolCall(
      {
        id: "t1",
        name: "transfer_to_agent",
        input: { agent_id: "agent_2", reason: "Billing question about an invoice." },
      },
      context,
      ALL,
    );

    expect(result.isError).toBeUndefined();
    expect(result.effect).toMatchObject({ kind: "transfer", toAgentName: "Dana" });
    // `activeAgentId` moves; `agentId` is half the unique key and must not.
    expect(conversationUpdates[0]).toEqual({ activeAgentId: "agent_2" });
    expect(conversationUpdates[0]).not.toHaveProperty("agentId");
    // The handover is written into the transcript for whoever reads it later.
    expect(messages[0]).toMatchObject({ role: "tool" });
    expect(String(messages[0]!.content)).toContain("Dana");
  });

  it("refuses a transfer to itself", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "transfer_to_agent", input: { agent_id: "agent_1", reason: "x" } },
      context,
      ALL,
    );
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/that is you/i);
    expect(conversationUpdates).toHaveLength(0);
  });

  it("refuses an unpublished or unknown colleague", async () => {
    for (const agent_id of ["agent_draft", "agent_nope"]) {
      const result = await executeToolCall(
        { id: "t1", name: "transfer_to_agent", input: { agent_id, reason: "x" } },
        context,
        ALL,
      );
      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/no colleague/i);
    }
    expect(conversationUpdates).toHaveLength(0);
  });

  it("tells the transferring agent to stop rather than answer anyway", async () => {
    const result = await executeToolCall(
      { id: "t1", name: "transfer_to_agent", input: { agent_id: "agent_2", reason: "x" } },
      context,
      ALL,
    );
    expect(result.content).toMatch(/do not answer their question yourself/i);
  });
});
