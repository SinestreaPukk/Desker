/**
 * "Is this agent doing its job?" - answered once, from signals Desker already
 * keeps: its runs (Work), what waits on a person (Needs you), the health of
 * the connections its tools need (Integrations, read from the audit trail),
 * and its schedule. The loader (agent-status-load.ts) gathers the facts; this
 * decides what they mean and what the owner can do about it.
 *
 * Every state that is not "fine" carries at least one action, because a red
 * dot an owner cannot act on is anxiety, not information.
 *
 * Pure and free of server imports: the roster, the agent page and the tests
 * all read the same verdict.
 */

export interface ConnectionProblem {
  connectorId: string;
  name: string;
  /** missing: never connected. off: turned off. attention: the last delivery failed. */
  state: "missing" | "off" | "attention";
  consequence: string;
}

export interface AgentStatusFacts {
  published: boolean;
  /** How it runs: manual, scheduled, triggered by an event, or paused. */
  runMode: "manual" | "scheduled" | "triggered" | "paused";
  cadence: string | null;
  /** The next scheduled start, when there is one. */
  nextRunAt: string | null;
  running: { id: string } | null;
  lastRun: { id: string; status: string; at: string; title: string; error: string | null; deliveryFailed: boolean } | null;
  /** Runs paused on an approval. */
  waiting: { id: string; count: number } | null;
  /** Open escalations and failures in Needs you. */
  flags: { id: string; count: number } | null;
  connections: ConnectionProblem[];
}

export type AgentStatusAction =
  | { kind: "retry"; runId: string; label: string }
  | { kind: "link"; href: string; label: string };

export interface AgentStatus {
  tone: "positive" | "accent" | "warning" | "danger" | "neutral";
  /** Three or four words: "On track", "Last run failed". */
  headline: string;
  /** One sentence: what happened, and what it costs. */
  detail: string;
  actions: AgentStatusAction[];
  facts: AgentStatusFacts;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A failure a reconnection would fix, rather than a retry. */
export function isConnectionError(error: string | null): boolean {
  return Boolean(error && /not connected|reconnect|connect it|unauthori[sz]ed|forbidden|expired|revoked|invalid[_ ]?(grant|token|api key)|\b40[13]\b/i.test(error));
}

export function describeAgentStatus(
  facts: AgentStatusFacts,
  links: { project: string; agentId: string },
): AgentStatus {
  const base = `/p/${links.project}`;
  const editor = `${base}/agents/${links.agentId}`;
  const reconnect = facts.connections.map((problem): AgentStatusAction => ({
    kind: "link",
    href: `${base}/integrations#${problem.connectorId}`,
    label: problem.state === "missing" ? `Connect ${problem.name}` : `Reconnect ${problem.name}`,
  }));
  const make = (tone: AgentStatus["tone"], headline: string, detail: string, actions: AgentStatusAction[]): AgentStatus => ({
    tone,
    headline,
    detail,
    actions,
    facts,
  });

  if (!facts.published) {
    return make("neutral", "Not switched on", `A draft does nothing on its own until you publish it.`, [
      { kind: "link", href: editor, label: "Finish setting up" },
    ]);
  }

  const last = facts.lastRun;
  if (last && last.status === "failed" && !facts.running) {
    const connection = isConnectionError(last.error);
    const actions: AgentStatusAction[] = [];
    if (connection && reconnect.length > 0) actions.push(...reconnect);
    actions.push({
      kind: "retry",
      runId: last.id,
      label: last.deliveryFailed ? "Try sending again" : "Retry the run",
    });
    actions.push({ kind: "link", href: `${base}/work/${last.id}`, label: "Why it failed" });
    return make(
      "danger",
      last.deliveryFailed ? "Couldn't send" : "Last run failed",
      last.error ? `${last.error}` : `Its last run stopped before it finished.`,
      actions,
    );
  }

  if (facts.connections.length > 0) {
    const first = facts.connections[0]!;
    return make(
      "warning",
      first.state === "missing" ? `${first.name} not connected` : `${first.name} needs attention`,
      first.consequence,
      reconnect,
    );
  }

  if (facts.waiting) {
    return make(
      "warning",
      "Waiting for your yes",
      `${plural(facts.waiting.count, "thing")} ready to go out, paused until you decide.`,
      [{ kind: "link", href: `${base}/needs-you?item=${facts.waiting.id}`, label: "Review in Needs you" }],
    );
  }

  if (facts.flags) {
    return make(
      "danger",
      "Flagged for you",
      `It stopped and asked for a person ${facts.flags.count === 1 ? "once" : `${facts.flags.count} times`}.`,
      [{ kind: "link", href: `${base}/needs-you?item=${facts.flags.id}`, label: "Open in Needs you" }],
    );
  }

  if (facts.running) {
    return make("accent", "Working now", "A run is in progress; this updates by itself.", [
      { kind: "link", href: `${base}/work/${facts.running.id}`, label: "Watch it" },
    ]);
  }

  if (facts.runMode === "paused") {
    return make("warning", "Schedule paused", `Its trigger is switched off, so it only works when you run it.`, [
      { kind: "link", href: editor, label: "Turn the schedule back on" },
    ]);
  }

  const when = facts.cadence ? facts.cadence : facts.runMode === "triggered" ? "When an event arrives" : null;
  if (!last) {
    return make(
      "neutral",
      "Hasn't run yet",
      when ? `First run: ${when.toLowerCase()}.` : `It works when you give it a task; nothing has run yet.`,
      [{ kind: "link", href: editor, label: "Run it now" }],
    );
  }

  return make(
    "positive",
    "On track",
    facts.runMode === "manual"
      ? `Its last run finished. It works when you give it a task.`
      : `Its last run finished; it next runs ${when ? when.toLowerCase() : "on its own"}.`,
    [],
  );
}
