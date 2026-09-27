import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildCompanyContextPrompt } from "@/lib/agent-prompt";

const base = {
  name: "Mia",
  jobTitle: "Customer Support Lead",
  department: "Customer Experience",
  personality: "Warm but efficient. Never uses corporate filler.",
  responsibilities: ["Answer order questions", "Log bugs clients report"],
  escalationRule: "Escalate if the client asks for a refund over $200.",
  allowedTools: ["search_documents", "escalate_to_human"],
};

describe("buildSystemPrompt", () => {
  it("names the agent, its title and its team", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("You are Mia, Customer Support Lead");
    expect(prompt).toContain("Customer Experience");
  });

  it("includes the personality verbatim", () => {
    expect(buildSystemPrompt(base)).toContain(base.personality);
  });

  it("lists every responsibility and closes the scope", () => {
    const prompt = buildSystemPrompt(base);
    for (const item of base.responsibilities) expect(prompt).toContain(item);
    expect(prompt).toContain("not on this list is not yours");
  });

  it("always states the non-negotiable boundaries", () => {
    const prompt = buildSystemPrompt({ ...base, allowedTools: [] });
    expect(prompt).toMatch(/never claim or imply that you are a human/i);
    expect(prompt).toMatch(/do not invent facts/i);
    expect(prompt).toMatch(/stay inside your role/i);
  });

  it("includes the escalation rule when escalation is permitted", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain(base.escalationRule);
    expect(prompt).toContain("escalate_to_human");
  });

  it("omits the escalation rule when the tool is not permitted", () => {
    const prompt = buildSystemPrompt({
      ...base,
      allowedTools: ["search_documents"],
    });
    expect(prompt).not.toContain("refund over $200");
  });

  it("only describes tools the agent is actually given", () => {
    const prompt = buildSystemPrompt({ ...base, allowedTools: ["log_issue"] });
    expect(prompt).toContain("log_issue");
    expect(prompt).not.toContain("search_documents");
    expect(prompt).not.toContain("log_suggestion");
  });

  it("says so plainly when the agent has no tools at all", () => {
    const prompt = buildSystemPrompt({ ...base, allowedTools: [] });
    expect(prompt).toContain("You have no tools in this role");
  });

  it("ignores unknown tool ids rather than leaking them into the prompt", () => {
    const prompt = buildSystemPrompt({
      ...base,
      allowedTools: ["definitely_not_a_tool"],
    });
    expect(prompt).not.toContain("definitely_not_a_tool");
    expect(prompt).toContain("You have no tools in this role");
  });

  it("lists searchable documents only when search is permitted", () => {
    const withSearch = buildSystemPrompt({
      ...base,
      documentNames: ["returns.md", "catalog.pdf"],
    });
    expect(withSearch).toContain("returns.md");

    const withoutSearch = buildSystemPrompt({
      ...base,
      allowedTools: ["log_issue"],
      documentNames: ["returns.md"],
    });
    expect(withoutSearch).not.toContain("returns.md");
  });

  it("lists colleagues only when transfer is permitted", () => {
    const colleagues = [
      { id: "agent_2", name: "Dana", jobTitle: "Billing Analyst", department: "Finance" },
    ];

    const withTransfer = buildSystemPrompt({
      ...base,
      allowedTools: ["transfer_to_agent"],
      colleagues,
    });
    expect(withTransfer).toContain("Dana");
    // The id has to be exact, or the tool call cannot resolve.
    expect(withTransfer).toContain("agent_2");

    const withoutTransfer = buildSystemPrompt({ ...base, colleagues });
    expect(withoutTransfer).not.toContain("Dana");
  });

  it("says plainly when there is nobody to transfer to", () => {
    const prompt = buildSystemPrompt({
      ...base,
      allowedTools: ["transfer_to_agent"],
      colleagues: [],
    });
    expect(prompt).toMatch(/nobody else is published/i);
  });

  it("includes recall of a returning client, with a caveat not to trust it blindly", () => {
    const prompt = buildSystemPrompt({
      ...base,
      recall: "- 2026-09-01, with Mia: Asked about a delayed order.",
    });
    expect(prompt).toContain("Asked about a delayed order");
    expect(prompt).toMatch(/do not assume it is still accurate/i);
  });

  it("omits the recall section entirely for a first-time client", () => {
    expect(buildSystemPrompt({ ...base, recall: null })).not.toContain(
      "spoken to us before",
    );
    expect(buildSystemPrompt({ ...base, recall: "   " })).not.toContain(
      "spoken to us before",
    );
  });

  it("handles a missing department without emitting a dangling separator", () => {
    const prompt = buildSystemPrompt({ ...base, department: null });
    expect(prompt).toContain("You are Mia, Customer Support Lead.");
    expect(prompt).not.toContain("on the  team");
  });

  it("includes company context when provided", () => {
    const prompt = buildSystemPrompt({
      ...base,
      companyContext: "Northwind Supply Co. sells hand tools and workwear.",
    });
    expect(prompt).toContain("Company context");
    expect(prompt).toContain("Northwind Supply Co. sells hand tools and workwear.");
  });

  it("addresses an internal colleague and encourages proactive execution when audience is colleague", () => {
    const prompt = buildSystemPrompt({
      ...base,
      audience: "colleague",
    });
    expect(prompt).toContain("collaborating directly with your teammate / manager");
    expect(prompt).toContain("take initiative in these areas when collaborating with your colleague");
    expect(prompt).not.toContain("Work that is not on this list is not yours to take on.");
    expect(prompt).toMatch(/do your job proactively/i);
    expect(prompt).toMatch(/do not artificially refuse tasks outside existing documents/i);
  });
});

describe("buildCompanyContextPrompt", () => {
  it("addresses an internal platform user and clarifies it is not an outside client", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Customer Support Lead",
      department: "Customer Experience",
    });
    expect(prompt).toContain("You are Mia, Customer Support Lead");
    expect(prompt).toContain("Customer Experience");
    expect(prompt).toMatch(/internal platform user \/ team member of the company/i);
    expect(prompt).toMatch(/not an outside client or customer/i);
  });

  it("sets the purpose to company-context consultation and forbids client escalation/tickets", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Customer Support Lead",
    });
    expect(prompt).toMatch(/company-context consultation mode/i);
    expect(prompt).toMatch(/do not treat the user as an external client/i);
    expect(prompt).toMatch(/do not offer client escalation/i);
  });

  it("embeds company and project context when provided", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Support Lead",
      companyContext: "Acme sells high-end coffee beans. Return policy is 30 days.",
    });
    expect(prompt).toContain("Acme sells high-end coffee beans");
    expect(prompt).toContain("Company context");
  });

  it("lists searchable documents and search_documents guidance", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Support Lead",
      documentNames: ["handbook.pdf", "pricing.md"],
    });
    expect(prompt).toContain("handbook.pdf");
    expect(prompt).toContain("pricing.md");
    expect(prompt).toContain("search_documents");
    expect(prompt).toMatch(/mention the document filename in plain words/i);
  });

  it("notes when no documents are uploaded yet", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Support Lead",
      documentNames: [],
    });
    expect(prompt).toMatch(/no documents have been indexed for this role yet/i);
  });

  it("instructs grounding answers and admitting missing information", () => {
    const prompt = buildCompanyContextPrompt({
      name: "Mia",
      jobTitle: "Support Lead",
    });
    expect(prompt).toMatch(/ground your answers in the company context/i);
    expect(prompt).toMatch(/do not make up facts, numbers, or policies/i);
  });
});

