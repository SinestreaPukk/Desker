/**
 * The check a run makes before it spends a token: does the agent have the
 * grounding its work needs? An agent missing the basics would otherwise spend
 * several tool calls confirming the same absence on every run. One check here
 * replaces all of that with a single, specific escalation.
 *
 * What a role needs is read off its tools, because the role template sets
 * them: an agent that writes needs the audience and the house style, and one
 * whose role was scoped to writing also needs to know what to write about.
 * An agent with no tool list (every tool) only gets the company-wide checks:
 * it was never told it is a writer, so it is not held to a writer's brief.
 *
 * Pure: the runner loads the facts, this decides.
 */
import type { ContextAnswers } from "./context";

/** Tools whose output is written in the company's voice for its customers. */
const WRITING_TOOLS = ["draft_content", "publish_post", "send_email"];

export interface PreflightInput {
  /** The project's shared context answers, keyed by question id. */
  projectAnswers: ContextAnswers;
  /** The agent's own context answers, keyed by question id. */
  agentAnswers: ContextAnswers;
  objectives: string[];
  /** The scope's tool allowlist; null means every tool. */
  tools: readonly string[] | null;
  /** Ready documents the run may search. */
  documentCount: number;
  /** The action item's trigger: manual | schedule | webhook | followup. */
  trigger: string;
}

/** What is missing, in the owner's words. Empty means the run may start. */
export function missingGrounding(input: PreflightInput): string[] {
  const missing: string[] = [];
  const project = (id: string) => Boolean(input.projectAnswers[id]?.trim());
  const agent = (id: string) => Boolean(input.agentAnswers[id]?.trim());
  const writes = !input.tools || input.tools.some((tool) => WRITING_TOOLS.includes(tool));
  const scopedWriter = Boolean(input.tools) && writes;

  if (!project("business")) missing.push("What the business does (Company context)");
  if (writes) {
    if (!project("audience")) missing.push("Who the customers are (Company context)");
    if (!project("tone")) missing.push("How agents should sound (Company context)");
  }
  // The content calendar, the campaign, the brief: said in the agent's own
  // context or in a document it can search. Neither means it writes blind.
  if (scopedWriter && !agent("project") && input.documentCount === 0) {
    missing.push(
      "What to write about - the campaign, calendar or brief (this agent's context, or an uploaded document)",
    );
  }
  // A person, a follow-up or an incoming event says what it wants; a schedule
  // never does, so a scheduled run with no objectives has nothing to work towards.
  if (input.trigger === "schedule" && input.objectives.length === 0) {
    missing.push("Standing objectives (Scope of work)");
  }
  return missing;
}
