/**
 * Named workflows: a few multi-agent sequences an owner can start on purpose
 * and follow end to end. Deliberately not a workflow builder - each one is a
 * fixed, repeatable sequence, so it shows which hand-offs matter before
 * anyone invests in a tool for building arbitrary ones.
 *
 * Each step is owned by one agent and runs as an ordinary run. When a step
 * finishes, the next starts with its results (workflow-run.ts); the step
 * that sends anything stops in Needs you, like any other send. Progress is
 * read off those runs - nothing is tracked twice.
 *
 * Pure and free of server imports: the Workflows page, the start API and the
 * tests read the same definitions.
 */
export interface WorkflowStep {
  /** Which kind of agent owns it; matched against job titles to suggest one. */
  role: string;
  /** The role, as the owner reads it. */
  roleLabel: string;
  match: RegExp;
  title: string;
  /** What the step's agent is told. `input` is what the owner typed at the start. */
  instruction: (input: string) => string;
}

export interface Workflow {
  id: string;
  name: string;
  pitch: string;
  input: { label: string; placeholder: string; optional?: boolean };
  steps: WorkflowStep[];
  /** What the owner decides at the end, in Needs you. */
  gate: string;
}

export const WORKFLOWS: readonly Workflow[] = [
  {
    id: "money-to-reminders",
    name: "Money check-in → reminders",
    pitch: "Your money manager adds up your latest statement and picks what to change; life admin puts a reminder in your calendar for each one.",
    input: { label: "Anything to focus on?", placeholder: "Subscriptions, and anything that went up this month", optional: true },
    steps: [
      {
        role: "money-manager",
        roleLabel: "Money",
        match: /money|financ|budget|spend/i,
        title: "Add up the statement",
        instruction: (input) =>
          `Add up my latest uploaded statement with review_spending${input ? `, focusing on: ${input}` : ""}. Pick at most three concrete changes - a subscription to cancel, a bill to renegotiate, a category to cap - each with the exact next step and a date to do it by. A colleague turns them into calendar reminders next.`,
      },
      {
        role: "personal-assistant",
        roleLabel: "Life admin",
        match: /assistant|admin|organi[sz]er|life/i,
        title: "Put reminders in the calendar",
        instruction: () =>
          "For each change in the check-in below, add one short calendar reminder on the date given with calendar_create_event - each waits for my approval. If no calendar is connected, list the reminders in your report instead.",
      },
    ],
    gate: "You approve the reminders",
  },
];

export function workflowById(id: string): Workflow | undefined {
  return WORKFLOWS.find((workflow) => workflow.id === id);
}

/** The agent to suggest for a step: the first published one whose job title fits. */
export function suggestAgent<T extends { jobTitle: string; status: string }>(step: WorkflowStep, agents: T[]): T | null {
  return agents.find((agent) => agent.status === "published" && step.match.test(agent.jobTitle)) ?? null;
}

/** What a workflow's runs carry in their payload, so progress can be read back. */
export interface WorkflowTag {
  id: string;
  /** The first step's run: the one every later step points back to. */
  rootId: string | null;
  step: number;
  /** The agent that owns each step, chosen when it started. */
  agents: string[];
  input: string;
}

export type StepState = "not_started" | "with_agent" | "needs_you" | "done" | "failed" | "stopped";

/** Where one step's work is, in the three places an owner cares about. */
export function stepState(status: string | null, openFlag: boolean): StepState {
  if (!status) return "not_started";
  if (status === "needs_approval" || openFlag) return "needs_you";
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "rejected" || status === "cancelled") return "stopped";
  return "with_agent";
}

/** The step a workflow is on: the first not done, or the last when all are. */
export function currentStep(states: StepState[]): number {
  const index = states.findIndex((state) => state !== "done");
  return index === -1 ? states.length - 1 : index;
}
