/**
 * What the agent tells its owner about a run.
 *
 * The runner already produces a report: the model's own write-up, in Markdown,
 * addressed to whoever reads the Work page. It is accurate and it is nobody's
 * idea of a good morning read - it names tools, draft ids and objectives.
 * This turns that, plus what actually happened (steps, drafts, failures), into
 * three or four sentences a non-technical owner can act on, and pulls out the
 * one thing the agent thinks should happen next as a Suggestion.
 *
 * Both artefacts are kept: `ActionItem.summary` is what a person sees first,
 * `result.summary` stays underneath as the raw report.
 *
 * One extra model call per run, capped short. When no provider key is
 * configured - a self-hosted install, a test - the fallback composes the same
 * shape from the data alone, so the product never shows an owner a blank
 * where its account of itself should be.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { publishAdminEvent } from "@/lib/events";
import { getProvider, type ChatMessage } from "@/lib/llm/provider";
import { clamp, firstSentences, parseModelJson, stringField } from "./model-json";
import type { WorkStep } from "./types";

interface RunSuggestion {
  summary: string;
  rationale: string;
  proposal: string;
}

interface RunSummary {
  headline: string;
  summary: string;
  suggestion: RunSuggestion | null;
}

const SYSTEM_PROMPT = `You write the note an AI worker leaves for the small-business owner who employs it.

You are given one task the worker just carried out: the tools it used, what it produced, and its own technical report. Turn that into an update the owner reads first thing, in their language, not the system's.

Reply with one JSON object and nothing else:
{
  "headline": "under 70 characters, what this task amounted to",
  "summary": "three or four sentences: what you did, what you found, and - if you have one - what you think should happen next",
  "suggestion": null | {
    "summary": "one line: what you noticed",
    "rationale": "one or two sentences: why it matters to this business",
    "proposal": "one sentence, imperative: the next step you propose, specific enough to act on as-is"
  }
}

Rules for the summary:
- Write as the worker, in the first person, past tense. "Checked competitor pricing for the three accounts you flagged."
- Be concrete: name what you looked at, how many, what changed, what you wrote.
- Plain words: write for a busy owner who knows nothing about the topic. Everyday words, short sentences (under 20 words), no jargon, acronyms or marketing speak. If a technical term cannot be avoided, explain it in a few words.
- The headline follows the same rule: a plain statement of the result, not a label. "Found two cheaper suppliers" beats "Supplier analysis complete".
- Never name a tool, a draft id, a status or an objective number. The owner does not know what web_research is.
- If the task failed or stopped for approval, say so plainly and say what the owner needs to do.
- No preamble, no markdown, no bullet points.

Rules for the suggestion:
- Only when you genuinely have an opinion worth someone's time - something you noticed that the standing objectives do not already cover. Most tasks have none; null is the normal answer.
- Never propose something already done in this task, and never propose "keep monitoring".`;

/** Everything the summariser is allowed to see about a run. */
interface RunFacts {
  agentName: string;
  jobTitle: string;
  trigger: string;
  status: string;
  report: string;
  error: string | null;
  escalationReason: string | null;
  pendingTool: string | null;
  steps: WorkStep[];
  drafts: { kind: string; title: string }[];
  findings: { query: string }[];
}

const TRIGGER_WORDS: Record<string, string> = {
  schedule: "on its schedule",
  webhook: "because an event arrived",
  manual: "because you pressed Run now",
  followup: "as a follow-up it queued earlier",
};

function factsToPrompt(facts: RunFacts): string {
  const lines = [
    `Worker: ${facts.agentName}, ${facts.jobTitle}.`,
    `The task started ${TRIGGER_WORDS[facts.trigger] ?? "on its own"} and ended as: ${facts.status}.`,
  ];
  if (facts.steps.length > 0) {
    lines.push(
      "What it actually did, in order:\n" +
        facts.steps
          .map(
            (step) =>
              `- ${step.tool}(${clamp(JSON.stringify(step.input), 200)}) -> ${step.ok ? "" : "FAILED: "}${clamp(step.output, 300)}`,
          )
          .join("\n"),
    );
  }
  if (facts.findings.length > 0) {
    lines.push(`Research it ran: ${facts.findings.map((f) => f.query).join("; ")}.`);
  }
  if (facts.drafts.length > 0) {
    lines.push(
      `Content it wrote: ${facts.drafts.map((d) => `${d.kind.replace(/_/g, " ")} "${d.title}"`).join("; ")}.`,
    );
  }
  if (facts.pendingTool) {
    lines.push(
      facts.pendingTool === "send_email"
        ? "It is waiting for the owner to approve sending an email. Nothing has been sent."
        : "It is waiting for the owner to approve publishing a post. Nothing has gone out.",
    );
  }
  if (facts.escalationReason) lines.push(`It escalated to a human: ${facts.escalationReason}`);
  if (facts.error) lines.push(`It failed with: ${facts.error}`);
  lines.push(`Its own report:\n${facts.report || "(it wrote no report)"}`);
  return lines.join("\n\n");
}

/**
 * No model available: say what happened from the record alone. Duller than the
 * model's version and never wrong, which is the right trade for a fallback.
 */
export function fallbackSummary(facts: RunFacts): RunSummary {
  const research = facts.steps.filter((s) => s.tool === "web_research" || s.tool === "search_documents").length;
  const did: string[] = [];
  if (research > 0) did.push(`looked up ${research} ${research === 1 ? "thing" : "things"}`);
  if (facts.drafts.length > 0) {
    did.push(`wrote ${facts.drafts.length} draft${facts.drafts.length === 1 ? "" : "s"}`);
  }
  const followups = facts.steps.filter((s) => s.tool === "schedule_followup").length;
  if (followups > 0) did.push(`planned ${followups} more task${followups === 1 ? "" : "s"} for later`);

  const opening = facts.error
    ? `This task failed before it could finish: ${facts.error}`
    : did.length > 0
      ? `I ${did.join(", ")}.`
      : "I worked through my objectives and had nothing new to add.";

  const closing = facts.pendingTool
    ? facts.pendingTool === "send_email"
      ? "An email is waiting for your approval in the Inbox; nothing has been sent."
      : "A post is waiting for your approval in the Inbox; nothing has gone out."
    : facts.escalationReason
      ? `I flagged this for you: ${facts.escalationReason}`
      : "";

  const report = firstSentences(facts.report, 2);
  const summary = [opening, report, closing].filter(Boolean).join(" ");

  const headline = facts.error
    ? "The task failed"
    : facts.pendingTool
      ? "Waiting for your approval"
      : facts.drafts.length > 0
        ? clamp(`Drafted ${facts.drafts[0]!.title}`, 70)
        : research > 0
          ? "Looked into it"
          : "Task finished";

  return { headline, summary: clamp(summary, 700), suggestion: null };
}

function toSuggestion(source: unknown): RunSuggestion | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const summary = stringField(record, "summary");
  const proposal = stringField(record, "proposal");
  if (!summary || !proposal) return null;
  return {
    summary: clamp(summary, 160),
    rationale: clamp(stringField(record, "rationale") || summary, 400),
    proposal: clamp(proposal, 400),
  };
}

/** One model call. Returns null when no provider is configured or the call fails. */
async function askForSummary(
  facts: RunFacts,
  billing: { organizationId: string; agentId: string },
  model: { provider: string; name: string | null },
): Promise<RunSummary | null> {
  if (!env.hasAnthropicKey && !env.hasOpenAiKey) return null;
  const messages: ChatMessage[] = [{ role: "user", content: factsToPrompt(facts) }];
  try {
    const provider = await getProvider(model.provider);
    const turn = await provider.complete({
      billing,
      systemPrompt: SYSTEM_PROMPT,
      messages,
      tools: [],
      model: model.name,
      maxTokens: 700,
    });
    const parsed = parseModelJson(turn.message.content);
    const summary = stringField(parsed, "summary");
    if (!summary) return null;
    return {
      headline: clamp(stringField(parsed, "headline") || firstSentences(summary, 1), 80),
      summary: clamp(summary, 900),
      suggestion: toSuggestion(parsed?.suggestion),
    };
  } catch (error) {
    console.error("[work/summary] model call failed", error);
    return null;
  }
}

/**
 * Writes the plain-language summary onto a finished run, and records the
 * agent's recommendation as a Suggestion when it has one.
 *
 * Idempotent: a retried step finds the summary already written and stops, so a
 * resumed run never pays for a second call or raises the same suggestion twice.
 */
export async function summarizeRun(actionItemId: string): Promise<RunSummary | null> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
          modelProvider: true,
          model: true,
        },
      },
      drafts: { select: { kind: true, title: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!item || item.summary) return null;

  const result = (item.result as Record<string, unknown> | null) ?? {};
  const pending = item.pendingAction as { tool?: string } | null;
  const facts: RunFacts = {
    agentName: item.agent.name,
    jobTitle: item.agent.jobTitle,
    trigger: item.trigger,
    status: item.status,
    report: typeof result.summary === "string" ? result.summary : "",
    error: item.error,
    escalationReason: item.escalationReason,
    pendingTool: pending?.tool ?? null,
    steps: ((item.steps as unknown as WorkStep[] | null) ?? []).slice(-20),
    drafts: item.drafts,
    findings: ((result.findings as { query: string }[] | undefined) ?? []).map((f) => ({ query: f.query })),
  };

  const summary =
    (await askForSummary(facts, { organizationId: item.organizationId, agentId: item.agent.id }, {
      provider: item.agent.modelProvider,
      name: item.agent.model,
    })) ?? fallbackSummary(facts);

  // A second writer (a retried step, a concurrent run) may have got here
  // first; the condition keeps the first summary and its suggestion.
  const written = await prisma.actionItem.updateMany({
    where: { id: actionItemId, summary: null },
    data: { summary: summary.summary, headline: summary.headline },
  });
  if (written.count === 0) return null;

  if (summary.suggestion) {
    await recordSuggestion({
      organizationId: item.organizationId,
      agentId: item.agent.id,
      actionItemId,
      ...summary.suggestion,
    });
  }
  return summary;
}

/** Stores an agent-initiated recommendation and tells the open dashboards about it. */
async function recordSuggestion(input: {
  organizationId: string;
  agentId: string;
  actionItemId?: string | null;
  summary: string;
  rationale: string;
  proposal: string;
}): Promise<void> {
  try {
    const row = await prisma.suggestion.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        actionItemId: input.actionItemId ?? null,
        summary: input.summary,
        rationale: input.rationale,
        proposal: input.proposal,
      },
      select: { id: true },
    });
    publishAdminEvent({ type: "suggestion.created", agentId: input.agentId, suggestionId: row.id });
    await audit({
      organizationId: input.organizationId,
      actorType: "agent",
      actorId: input.agentId,
      action: "suggestion.created",
      targetType: "suggestion",
      targetId: row.id,
      metadata: { summary: input.summary.slice(0, 300) },
    });
  } catch (error) {
    // A lost suggestion must never fail the run that produced it.
    console.error("[work/summary] suggestion not recorded", error);
  }
}
