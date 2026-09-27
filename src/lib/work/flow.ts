/**
 * A scope of work, read as a pipeline.
 *
 * The editor is a form because most of what an agent has is a handful of
 * independent settings - a name, a tone, which documents to use - and a form
 * is what those are for. The scope of work is the one part that genuinely is
 * a sequence: something starts a run, the agent reasons over it, it may call
 * certain tools, anything leaving the building stops for a person, and the
 * result lands somewhere. A sequence is easier to check at a glance as a
 * picture than as five form sections held in your head.
 *
 * So this derives the picture from the record and nothing else. There is no
 * graph to store, no nodes to add or remove, no edges to rewire: the diagram
 * is a reading of the same fields the form edits, which is why the two views
 * cannot drift apart. Wiring arbitrary pipelines is where tools like n8n get
 * complicated, and it is not what this product promises.
 */
import { describeCadence } from "./cadence";
import { GATED_TOOLS, WORK_TOOL_IDS, WORK_TOOL_METADATA, type WorkToolId } from "./tools";
import { effectiveAutonomy, type AutonomyMode, type ToolAutonomy, type TriggerType } from "./types";

/** Which focused control a node opens when it is clicked. */
type ScopeFlowSection = "trigger" | "context" | "objectives" | "tools" | "trust" | "digest";

type ScopeFlowKind = "trigger" | "agent" | "tool" | "approval" | "output";

export interface ScopeFlowNode {
  id: string;
  kind: ScopeFlowKind;
  title: string;
  /** One line under the title: what this step actually does, in plain words. */
  detail: string;
  tone: "neutral" | "accent" | "warning";
  section: ScopeFlowSection;
  /** Set on tool nodes, so the editor opens that one tool. */
  tool?: WorkToolId;
  /** Drawn faintly: configured, but not currently doing anything. */
  dimmed?: boolean;
}

export interface ScopeFlowInput {
  agentName: string;
  jobTitle: string;
  triggerType: TriggerType;
  cron: string | null;
  timezone: string;
  enabled: boolean;
  tools: readonly WorkToolId[];
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy | null;
  objectiveCount: number;
  contextAnswered: number;
  /** "off" | "daily" | "weekly" - what the agent reports back, and how often. */
  digestCadence: string;
}

function triggerNode(input: ScopeFlowInput): ScopeFlowNode {
  const dimmed = input.triggerType !== "manual" && !input.enabled;
  if (input.triggerType === "cron") {
    return {
      id: "trigger",
      kind: "trigger",
      title: "On a schedule",
      detail: dimmed
        ? `Paused. Would run ${describeCadence(input.cron, input.timezone).toLowerCase()}.`
        : `${describeCadence(input.cron, input.timezone)}.`,
      tone: dimmed ? "neutral" : "accent",
      section: "trigger",
      dimmed,
    };
  }
  if (input.triggerType === "webhook") {
    return {
      id: "trigger",
      kind: "trigger",
      title: "When an event arrives",
      detail: dimmed
        ? "Paused. The webhook URL will not start a run."
        : "A system posts JSON to this agent's private webhook URL.",
      tone: dimmed ? "neutral" : "accent",
      section: "trigger",
      dimmed,
    };
  }
  return {
    id: "trigger",
    kind: "trigger",
    title: "Only when you run it",
    detail: "Nothing starts on its own. Press Run now to start a run.",
    tone: "neutral",
    section: "trigger",
  };
}

function agentDetail(input: ScopeFlowInput): string {
  const context =
    input.contextAnswered > 0
      ? `${input.contextAnswered} context answer${input.contextAnswered === 1 ? "" : "s"}`
      : "no context yet";
  const objectives =
    input.objectiveCount > 0
      ? `${input.objectiveCount} objective${input.objectiveCount === 1 ? "" : "s"}`
      : "no objectives yet";
  return `Reads ${context}, then works through ${objectives}.`;
}

/** Which of the outward tools stop for a person, in the owner's words. */
export function approvalDetail(input: ScopeFlowInput): string {
  const gated = GATED_TOOLS.filter((tool) => input.tools.includes(tool));
  const waiting = gated.filter(
    (tool) => effectiveAutonomy(input.autonomy, input.toolAutonomy, tool) === "draft_only",
  );
  const noun = (tool: WorkToolId) => (tool === "publish_post" ? "Posts" : "Emails");

  if (waiting.length === gated.length) {
    return `${gated.map(noun).join(" and ")} wait here until you approve them. Nothing goes out on its own.`;
  }
  if (waiting.length === 0) {
    return `${gated.map(noun).join(" and ")} go straight out. Nothing stops here.`;
  }
  const auto = gated.filter((tool) => !waiting.includes(tool));
  return `${waiting.map(noun).join(" and ")} wait for you; ${auto.map(noun).join(" and ").toLowerCase()} go straight out.`;
}

function outputDetail(input: ScopeFlowInput): string {
  const sends = GATED_TOOLS.some((tool) => input.tools.includes(tool));
  const digest =
    input.digestCadence === "daily"
      ? " You get a digest every morning."
      : input.digestCadence === "weekly"
        ? " You get a digest once a week."
        : "";
  return (
    (sends
      ? "Drafts and the run's summary land under Work; approved posts and emails go to the connected integration."
      : "Drafts and the run's summary land under Work. Nothing leaves the building.") + digest
  );
}

/**
 * The nodes, in reading order. Tools keep the order of the tool registry so
 * the picture does not rearrange itself when a box is ticked.
 */
export function buildScopeFlow(input: ScopeFlowInput): ScopeFlowNode[] {
  const tools = WORK_TOOL_IDS.filter((tool) => input.tools.includes(tool));
  const nodes: ScopeFlowNode[] = [
    triggerNode(input),
    {
      id: "agent",
      kind: "agent",
      title: input.agentName || "This agent",
      detail: agentDetail(input),
      tone: "accent",
      section: "context",
    },
  ];

  if (tools.length === 0) {
    nodes.push({
      id: "tools-empty",
      kind: "tool",
      title: "No tools",
      detail: "With nothing ticked the agent can only write a report. Add at least one tool.",
      tone: "warning",
      section: "tools",
      dimmed: true,
    });
  } else {
    for (const tool of tools) {
      nodes.push({
        id: `tool:${tool}`,
        kind: "tool",
        title: WORK_TOOL_METADATA[tool].label,
        detail: WORK_TOOL_METADATA[tool].blurb,
        tone: GATED_TOOLS.includes(tool as (typeof GATED_TOOLS)[number]) ? "warning" : "neutral",
        section: "tools",
        tool,
      });
    }
  }

  // The gate exists only when something in the pipeline can reach the outside
  // world. An agent that only researches and drafts has nothing to approve.
  if (GATED_TOOLS.some((tool) => input.tools.includes(tool))) {
    nodes.push({
      id: "approval",
      kind: "approval",
      title: "Your approval",
      detail: approvalDetail(input),
      tone: "warning",
      section: "trust",
    });
  }

  nodes.push({
    id: "output",
    kind: "output",
    title: "Where it lands",
    detail: outputDetail(input),
    tone: "neutral",
    section: "digest",
  });

  return nodes;
}
