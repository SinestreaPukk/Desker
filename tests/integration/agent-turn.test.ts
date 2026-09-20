/**
 * Live integration test: a real conversation turn against a real model API.
 *
 * This is the test that proves the product actually works rather than that its
 * parts typecheck. It runs the same `runAgentTurn` the public chat endpoint
 * runs, against a live Claude API key, and asserts on the database rows the
 * tool calls left behind.
 *
 * Requires ANTHROPIC_API_KEY and a reachable DATABASE_URL. Run with:
 *
 *   npm run test:integration
 *
 * It is deliberately excluded from `npm test` so a contributor without a key
 * still gets a green unit suite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runAgentTurn, type RuntimeEvent } from "@/lib/agent-runtime";
import { chunkText } from "@/lib/rag/chunk";
import { embedBatch } from "@/lib/rag/embeddings";

const prisma = new PrismaClient();

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
const describeLive = hasKey ? describe : describe.skip;

if (!hasKey) {
  console.warn(
    "\n[integration] ANTHROPIC_API_KEY is not set - live model tests skipped.\n",
  );
}

const POLICY = `# Acme Returns Policy

## Return window
Unused items may be returned within 30 days of delivery for a full refund.
Items returned between 31 and 60 days receive store credit only.

## Restocking fee
A 15% restocking fee applies to opened electronics returned after 14 days.

## Warranty
Power tools carry a 24-month manufacturer warranty.
`;

let projectId: string;
let agentId: string;
let conversationId: string;

/** Collects a full streamed turn into an array so it can be asserted on. */
async function collect(
  message: string,
  options: { conversation?: string } = {},
): Promise<{ events: RuntimeEvent[]; text: string }> {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const events: RuntimeEvent[] = [];
  let text = "";

  for await (const event of runAgentTurn({
    agent,
    conversationId: options.conversation ?? conversationId,
    userMessage: message,
    persist: true,
  })) {
    events.push(event);
    if (event.type === "text") text += event.text;
  }

  return { events, text };
}

function toolsUsed(events: RuntimeEvent[]): string[] {
  return events
    .filter((event): event is Extract<RuntimeEvent, { type: "tool_end" }> =>
      event.type === "tool_end",
    )
    .map((event) => event.name);
}

beforeAll(async () => {
  const project = await prisma.project.create({
    data: {
      name: `Integration ${Date.now()}`,
      slug: `integration-${Date.now()}`,
      organization: {
        create: {
          name: `Integration org ${Date.now()}`,
          slug: `integration-org-${Date.now()}`,
        },
      },
    },
  });
  projectId = project.id;

  const agent = await prisma.agent.create({
    data: {
      projectId,
      name: "TestBot",
      jobTitle: "Support Specialist",
      department: "Integration Tests",
      personality:
        "Direct and factual. Answers in one or two sentences with no preamble.",
      responsibilities: [
        "Answer questions about the returns policy",
        "Log bugs clients report",
        "Record feature requests",
      ],
      allowedTools: [
        "search_company_context",
        "log_issue",
        "log_suggestion",
        "escalate_to_human",
      ],
      escalationRule:
        "Escalate if the client asks for a refund over $200 or asks to speak to a person.",
      status: "published",
      modelProvider: "anthropic",
    },
  });
  agentId = agent.id;

  // Index a document through the same chunk + embed path the uploader uses.
  const document = await prisma.document.create({
    data: {
      agentId,
      filename: "returns-policy.md",
      mimeType: "text/markdown",
      storageKey: "test/returns-policy.md",
      sizeBytes: POLICY.length,
      status: "ready",
    },
  });

  const chunks = chunkText(POLICY);
  const embeddings = await embedBatch(chunks);
  await prisma.documentChunk.createMany({
    data: chunks.map((content, index) => ({
      documentId: document.id,
      agentId,
      content,
      chunkIndex: index,
      embeddingJson: JSON.stringify(embeddings[index] ?? []),
    })),
  });
  await prisma.document.update({
    where: { id: document.id },
    data: { chunkCount: chunks.length },
  });

  const conversation = await prisma.conversation.create({
    data: { agentId, clientSessionId: `integration-${Date.now()}` },
  });
  conversationId = conversation.id;
}, 60_000);

afterAll(async () => {
  // Deleting the organisation cascades to the project, the agent and everything under it.
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (project) {
      await prisma.organization
        .delete({ where: { id: project.organizationId } })
        .catch(() => {});
    }
  }
  await prisma.$disconnect();
});

describeLive("a live agent turn", () => {
  it("streams a grounded answer using the uploaded policy", async () => {
    const { events, text } = await collect(
      "How many days do I have to return an unused item for a full refund?",
    );

    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(toolsUsed(events)).toContain("search_company_context");
    // The answer must come from the document, not the model's own knowledge.
    expect(text).toMatch(/30/);

    const persisted = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    expect(persisted.some((message) => message.role === "user")).toBe(true);
    expect(persisted.some((message) => message.role === "assistant")).toBe(true);
    expect(persisted.some((message) => message.role === "tool")).toBe(true);
  });

  it("logs an issue when the client reports something broken", async () => {
    const conversation = await prisma.conversation.create({
      data: { agentId, clientSessionId: `integration-issue-${Date.now()}` },
    });

    const { events } = await collect(
      "Your checkout page throws a 500 error every time I click Pay with my saved card. " +
        "I have tried three times on Chrome and it fails every time.",
      { conversation: conversation.id },
    );

    expect(toolsUsed(events)).toContain("log_issue");

    const issues = await prisma.issue.findMany({
      where: { conversationId: conversation.id, type: "issue" },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.summary.length).toBeGreaterThan(5);
    expect(["low", "medium", "high", "critical"]).toContain(issues[0]!.severity);
  });

  it("records a suggestion separately from a bug", async () => {
    const conversation = await prisma.conversation.create({
      data: { agentId, clientSessionId: `integration-suggestion-${Date.now()}` },
    });

    const { events } = await collect(
      "Everything works fine, but it would be really useful if you offered a dark mode " +
        "for the account dashboard. I use it at night a lot.",
      { conversation: conversation.id },
    );

    expect(toolsUsed(events)).toContain("log_suggestion");

    const suggestions = await prisma.issue.findMany({
      where: { conversationId: conversation.id, type: "suggestion" },
    });
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("escalates and flags the conversation when the rule is met", async () => {
    const conversation = await prisma.conversation.create({
      data: { agentId, clientSessionId: `integration-escalate-${Date.now()}` },
    });

    const { events } = await collect(
      "This is unacceptable. I want a full refund of $450 right now and I want to " +
        "speak to a real person, not a bot.",
      { conversation: conversation.id },
    );

    expect(toolsUsed(events)).toContain("escalate_to_human");

    const updated = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });
    expect(updated.status).toBe("escalated");
  });

  it("does not invent an answer that is absent from the documents", async () => {
    const conversation = await prisma.conversation.create({
      data: { agentId, clientSessionId: `integration-unknown-${Date.now()}` },
    });

    const { text } = await collect(
      "What is your policy on international shipping to Japan?",
      { conversation: conversation.id },
    );

    // The policy says nothing about international shipping, so the agent must
    // say it does not know rather than fabricate a rule.
    expect(text.toLowerCase()).toMatch(
      /(don't have|do not have|couldn't find|could not find|not sure|no information|don't know|do not know|unable to|not covered|check with|colleague|human)/,
    );
  });

  it("replays a multi-turn conversation without losing tool pairing", async () => {
    const conversation = await prisma.conversation.create({
      data: { agentId, clientSessionId: `integration-multi-${Date.now()}` },
    });

    await collect("What is the return window?", { conversation: conversation.id });
    const { events, text } = await collect("And what about opened electronics?", {
      conversation: conversation.id,
    });

    // A dropped tool_use/tool_result pair would make the API reject this turn.
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(text.length).toBeGreaterThan(10);
  });
});

describe("agent runtime wiring", () => {
  it("creates the fixture agent, document and chunks regardless of API key", async () => {
    const chunks = await prisma.documentChunk.count({ where: { agentId } });
    expect(chunks).toBeGreaterThan(0);
  });
});
