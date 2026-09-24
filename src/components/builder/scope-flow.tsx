"use client";

import * as React from "react";
import {
  Bot,
  Clock,
  FileDown,
  Mail,
  Megaphone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Webhook,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buildScopeFlow, type ScopeFlowNode } from "@/lib/work/flow";
import { AGENT_CONTEXT_QUESTIONS, answeredCount } from "@/lib/work/context";
import type { WorkToolId } from "@/lib/work/tools";
import { cn } from "@/lib/utils";
import {
  ContextSection,
  DigestSettings,
  DocumentsSection,
  ObjectivesSection,
  ToolsSection,
  TriggerSection,
  TrustSettings,
  parseObjectives,
  type ScopeFormState,
} from "./scope-of-work-form";

const NODE_ICON: Record<string, typeof Bot> = {
  trigger: Clock,
  "trigger:webhook": Webhook,
  "trigger:manual": Play,
  agent: Bot,
  approval: ShieldCheck,
  output: FileDown,
  "tool:search_context": Search,
  "tool:web_research": Search,
  "tool:draft_content": Sparkles,
  "tool:publish_post": Megaphone,
  "tool:send_email": Mail,
  "tool:schedule_followup": Clock,
  "tool:escalate_to_human": TriangleAlert,
  "tools-empty": TriangleAlert,
};

/** The map key for a node's icon. A string, so the icon itself is a lookup. */
function iconKey(node: ScopeFlowNode, triggerType: string): string {
  return node.kind === "trigger" ? `trigger:${triggerType}` : node.id;
}

const TONE: Record<ScopeFlowNode["tone"], string> = {
  neutral: "border-line bg-surface",
  accent: "border-accent-line bg-accent-soft/30",
  warning: "border-warning-line bg-warning-soft/30",
};

/** The rail between two nodes. Decorative: the order is in the reading, not the line. */
function Connector({ label }: { label?: string }) {
  return (
    <div aria-hidden className="flex items-center gap-2 pl-[1.375rem]">
      <span className="h-6 w-px bg-line" />
      {label ? <span className="text-[0.6875rem] text-ink-subtle">{label}</span> : null}
    </div>
  );
}

/**
 * The scope of work as a small diagram.
 *
 * Deliberately not a workflow builder: nodes cannot be added, removed or
 * rewired, because the pipeline's shape comes from the configuration rather
 * than the other way round. Clicking one opens the same control the form view
 * has for that setting, bound to the same state - so this is a view and a
 * navigation shortcut, not a second way to edit.
 */
export function ScopeFlow({
  value,
  onChange,
  agent,
  fieldErrors = {},
  webhookUrl,
  documents = [],
}: {
  value: ScopeFormState;
  onChange: (next: ScopeFormState) => void;
  agent: { name: string; jobTitle: string };
  fieldErrors?: Record<string, string[]>;
  webhookUrl?: string | null;
  documents?: { id: string; filename: string }[];
}) {
  const [open, setOpen] = React.useState<ScopeFlowNode | null>(null);

  const nodes = buildScopeFlow({
    agentName: agent.name,
    jobTitle: agent.jobTitle,
    triggerType: value.triggerType,
    cron: value.cron,
    timezone: value.timezone,
    enabled: value.enabled,
    tools: value.tools,
    autonomy: value.autonomy,
    toolAutonomy: value.toolAutonomy,
    objectiveCount: parseObjectives(value.objectivesText).length,
    contextAnswered: answeredCount(value.contextAnswers, AGENT_CONTEXT_QUESTIONS),
    digestCadence: value.digestCadence,
  });

  return (
    <div className="space-y-1">
      <p className="mb-3 text-xs text-ink-muted">
        One run, top to bottom. Click any step to edit it - it is the same setting as in the form
        view, so nothing here can get out of step with what the agent actually does.
      </p>

      <ol className="space-y-0">
        {nodes.map((node, index) => (
          <li key={node.id}>
            {index > 0 ? <Connector /> : null}
            <FlowNode node={node} triggerType={value.triggerType} onOpen={() => setOpen(node)} />
          </li>
        ))}
      </ol>

      <NodeEditor
        node={open}
        onClose={() => setOpen(null)}
        value={value}
        onChange={onChange}
        fieldErrors={fieldErrors}
        webhookUrl={webhookUrl}
        documents={documents}
      />
    </div>
  );
}

function FlowNode({
  node,
  triggerType,
  onOpen,
}: {
  node: ScopeFlowNode;
  triggerType: string;
  onOpen: () => void;
}) {
  const Icon = NODE_ICON[iconKey(node, triggerType)] ?? NODE_ICON[node.kind] ?? Send;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        "hover:border-accent-line hover:bg-accent-soft/40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        TONE[node.tone],
        node.dimmed && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-muted [&_svg]:size-3.5"
      >
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{node.title}</span>
          {node.kind === "approval" ? <Badge tone="warning">Gate</Badge> : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{node.detail}</span>
      </span>
      <span className="mt-1 text-[0.6875rem] text-accent">Edit</span>
    </button>
  );
}

/** The heading and the one control each node owns. */
function NodeEditor({
  node,
  onClose,
  value,
  onChange,
  fieldErrors,
  webhookUrl,
  documents,
}: {
  node: ScopeFlowNode | null;
  onClose: () => void;
  value: ScopeFormState;
  onChange: (next: ScopeFormState) => void;
  fieldErrors: Record<string, string[]>;
  webhookUrl?: string | null;
  documents: { id: string; filename: string }[];
}) {
  if (!node) return null;
  const section = { value, onChange, fieldErrors, idPrefix: "flow" };

  const body =
    node.section === "trigger" ? (
      <TriggerSection {...section} webhookUrl={webhookUrl} />
    ) : node.section === "context" ? (
      <div className="space-y-5">
        <ContextSection {...section} heading={false} />
        <ObjectivesSection {...section} />
        <DocumentsSection {...section} documents={documents} />
      </div>
    ) : node.section === "tools" ? (
      <ToolsSection {...section} only={node.tool as WorkToolId | undefined} />
    ) : node.section === "trust" ? (
      <TrustSettings
        value={{ autonomy: value.autonomy, toolAutonomy: value.toolAutonomy }}
        onChange={(next) => onChange({ ...value, ...next })}
        idPrefix="flow-trust"
      />
    ) : (
      <DigestSettings
        value={{
          digestCadence: value.digestCadence,
          digestEmail: value.digestEmail,
          digestRecipients: value.digestRecipients,
        }}
        onChange={(next) => onChange({ ...value, ...next })}
        idPrefix="flow-digest"
      />
    );

  // Static per section, never the node's own line: the node describes the
  // current setting, which goes stale the moment it is edited in here.
  const description =
    node.section === "trigger"
      ? "What starts a run, and when. Research and drafting happen every time it fires."
      : node.section === "context"
        ? "What the agent reads before every run, and what a run should achieve."
        : node.section === "tools"
          ? node.tool
            ? "Untick it to take it out of the run, or add another tool from the form view."
            : "What the agent may do during a run."
          : node.section === "trust"
            ? "What the agent may send without asking. Research and drafts never wait."
            : "Where a finished run shows up, and how often the agent reports back.";

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>{node.title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">{body}</div>
        <p className="mt-4 text-xs text-ink-muted">
          Changes apply when you save the scope of work, the same as in the form view.
        </p>
      </DialogContent>
    </Dialog>
  );
}
