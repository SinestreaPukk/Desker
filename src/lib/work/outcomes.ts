/**
 * The numbers that decide what to build next: how long approvals take, how
 * often work has to be redone, how often runs fail, and how each agent, each
 * role and each hand-off actually turns out. Computed from runs Desker
 * already keeps - nothing new is recorded to produce them.
 *
 * Pure, so the Insights API and the tests share one definition of each:
 *
 * - approval time: from a send reaching Needs you to the owner's decision (median).
 * - rework rate: of the decisions, the share rejected or edited before approval.
 * - failure rate: of the runs that finished, the share that failed.
 */
import { TEMPLATES, templateById } from "@/lib/content";

export interface OutcomeRun {
  id: string;
  agentId: string;
  status: string;
  type: string;
  awaitingSince: Date | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  parentAgentId: string | null;
}

export interface OutcomeAgent {
  id: string;
  name: string;
  jobTitle: string;
  templateId: string | null;
}

export interface Outcome {
  runs: number;
  done: number;
  failed: number;
  /** Decisions on sends: approved as written, approved after an edit, rejected. */
  approvedAsIs: number;
  approvedEdited: number;
  rejected: number;
  failureRate: number | null;
  reworkRate: number | null;
  approvalMedianMs: number | null;
}

export interface RoleOutcome extends Outcome {
  role: string;
  roleName: string;
  agents: number;
  /** Days in the range with at least one run: how steadily the role is used. */
  activeDays: number;
}

export interface HandoffOutcome extends Outcome {
  from: string;
  to: string;
}

/** The role an agent plays: its template, or the closest one by job title, or its own title. */
export function roleOf(agent: { templateId: string | null; jobTitle: string }): { id: string; name: string } {
  const template = agent.templateId ? templateById(agent.templateId) : undefined;
  if (template) return { id: template.id, name: template.name };
  const title = agent.jobTitle.trim().toLowerCase();
  const guess = TEMPLATES.find((t) => t.jobTitle.toLowerCase() === title);
  if (guess) return { id: guess.id, name: guess.name };
  return { id: `custom:${title}`, name: agent.jobTitle.trim() || "Custom" };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/** One outcome over a set of runs. `edited` holds the runs whose draft the owner changed before deciding. */
export function outcomeOf(runs: OutcomeRun[], edited: Set<string>): Outcome {
  const done = runs.filter((run) => run.status === "done").length;
  const failed = runs.filter((run) => run.status === "failed").length;
  const decidedApproved = runs.filter((run) => run.approvedAt);
  const approvedEdited = decidedApproved.filter((run) => edited.has(run.id)).length;
  const approvedAsIs = decidedApproved.length - approvedEdited;
  const rejected = runs.filter((run) => run.status === "rejected").length;
  const waits = runs
    .map((run) => {
      const decidedAt = run.approvedAt ?? (run.status === "rejected" ? run.completedAt : null);
      return run.awaitingSince && decidedAt ? decidedAt.getTime() - run.awaitingSince.getTime() : null;
    })
    .filter((ms): ms is number => ms !== null && ms >= 0);
  const decisions = approvedAsIs + approvedEdited + rejected;
  return {
    runs: runs.length,
    done,
    failed,
    approvedAsIs,
    approvedEdited,
    rejected,
    failureRate: ratio(failed, done + failed),
    reworkRate: ratio(approvedEdited + rejected, decisions),
    approvalMedianMs: median(waits),
  };
}

export function summarizeOutcomes(input: { runs: OutcomeRun[]; agents: OutcomeAgent[]; edited: Set<string> }) {
  const { runs, agents, edited } = input;
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  const byAgent = agents
    .map((agent) => ({ agentId: agent.id, name: agent.name, role: roleOf(agent).name, ...outcomeOf(runs.filter((run) => run.agentId === agent.id), edited) }))
    .filter((row) => row.runs > 0);

  const roles = new Map<string, { name: string; agents: Set<string>; runs: OutcomeRun[] }>();
  for (const run of runs) {
    const agent = agentById.get(run.agentId);
    if (!agent) continue;
    const role = roleOf(agent);
    const entry = roles.get(role.id) ?? { name: role.name, agents: new Set<string>(), runs: [] };
    entry.agents.add(agent.id);
    entry.runs.push(run);
    roles.set(role.id, entry);
  }
  const byRole: RoleOutcome[] = [...roles.entries()]
    .map(([role, entry]) => ({
      role,
      roleName: entry.name,
      agents: entry.agents.size,
      activeDays: new Set(entry.runs.map((run) => run.createdAt.toISOString().slice(0, 10))).size,
      ...outcomeOf(entry.runs, edited),
    }))
    .sort((a, b) => b.runs - a.runs);

  const pairs = new Map<string, OutcomeRun[]>();
  for (const run of runs) {
    if (run.type !== "colleague_delegation" || !run.parentAgentId) continue;
    const from = agentById.get(run.parentAgentId);
    const to = agentById.get(run.agentId);
    if (!from || !to) continue;
    const key = `${roleOf(from).name} → ${roleOf(to).name}`;
    pairs.set(key, [...(pairs.get(key) ?? []), run]);
  }
  const byHandoff: HandoffOutcome[] = [...pairs.entries()]
    .map(([key, list]) => {
      const [from, to] = key.split(" → ") as [string, string];
      return { from, to, ...outcomeOf(list, edited) };
    })
    // Most rejected first: that is the question it answers.
    .sort((a, b) => (b.reworkRate ?? -1) - (a.reworkRate ?? -1) || b.runs - a.runs);

  return { overall: outcomeOf(runs, edited), byAgent, byRole, byHandoff };
}
