"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Field, Input, Label } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEEKDAYS,
  cadenceToCron,
  cronToCadence,
  describeCadence,
  type Cadence,
} from "@/lib/work/cadence";
import {
  type AutonomyMode,
  type DigestCadence,
  type ToolAutonomy,
  type TriggerType,
} from "@/lib/work/types";
import { ContextHelper } from "./live-example";
import { ChoicePicker, ObjectivesEditor } from "./agent-setup";
import { choicesFor } from "@/lib/work/agent-choices";
import { useIntegrations } from "@/hooks/use-work-data";
import { CONNECTORS, connectorsForTool } from "@/lib/integrations/catalog";
import { GATED_TOOL_IDS } from "@/lib/work/types";
import { ContextQuestions } from "./context-questions";
import { looksLikeCron } from "@/lib/form-errors";
import { HelpLink } from "@/components/help/help-panel";
import {
  shownAgentQuestions,
  answeredCount,
  type ContextAnswers,
} from "@/lib/work/context";
import {
  GATED_TOOLS,
  WORK_TOOL_IDS,
  WORK_TOOL_METADATA,
  WORK_TOOL_RISK,
  type WorkToolId,
} from "@/lib/work/tools";
import { cn } from "@/lib/utils";

/** What the form edits. Objectives are one per line until they are saved. */
export interface ScopeFormState {
  /** Answers to the guided context questions, composed server-side on save. */
  contextAnswers: ContextAnswers;
  objectivesText: string;
  documentIds: string[];
  triggerType: TriggerType;
  cron: string;
  timezone: string;
  enabled: boolean;
  autonomy: AutonomyMode;
  toolAutonomy: ToolAutonomy;
  /** The work tools the agent may use during a run. The role template sets it. */
  tools: WorkToolId[];
  /** How often the agent writes its owner an update, unasked. */
  digestCadence: DigestCadence;
  digestEmail: boolean;
  /** Comma-separated. Empty means the organisation's owners and admins. */
  digestRecipients: string;
}

export function defaultScopeForm(): ScopeFormState {
  return {
    contextAnswers: {},
    objectivesText: "",
    documentIds: [],
    triggerType: "manual",
    cron: "0 9 * * 1",
    timezone: browserTimezone(),
    enabled: true,
    autonomy: "draft_only",
    toolAutonomy: {},
    tools: [...WORK_TOOL_IDS],
    digestCadence: "weekly",
    digestEmail: false,
    digestRecipients: "",
  };
}

const MODE_LABEL: Record<AutonomyMode, string> = {
  draft_only: "Draft only - wait for my approval",
  auto: "Auto - go straight out",
};

/**
 * How much the agent is trusted with the outside world. Agent-wide mode plus
 * a per-tool override, so an owner can let posts flow while emails still
 * wait. Shown in the editor only: every new agent starts draft-only.
 */
export function TrustSettings({
  value,
  onChange,
  idPrefix = "trust",
}: {
  value: Pick<ScopeFormState, "autonomy" | "toolAutonomy">;
  onChange: (next: Pick<ScopeFormState, "autonomy" | "toolAutonomy">) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-agent`}>Publishing and email</Label>
        <Select
          value={value.autonomy}
          onValueChange={(next) => onChange({ ...value, autonomy: next as AutonomyMode })}
        >
          <SelectTrigger id={`${idPrefix}-agent`} className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft_only">{MODE_LABEL.draft_only}</SelectItem>
            <SelectItem value="auto">{MODE_LABEL.auto}</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-ink-muted">
          Research, drafting and follow-ups never wait for you - they cannot reach anyone. This
          only decides whether posts and emails stop for your approval first.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GATED_TOOLS.map((tool) => {
          const override = value.toolAutonomy[tool];
          return (
            <div key={tool}>
              <Label htmlFor={`${idPrefix}-${tool}`} className="text-xs">
                {WORK_TOOL_METADATA[tool].label}
              </Label>
              <Select
                value={override ?? "inherit"}
                onValueChange={(next) => {
                  const toolAutonomy = { ...value.toolAutonomy };
                  if (next === "inherit") delete toolAutonomy[tool];
                  else toolAutonomy[tool] = next as AutonomyMode;
                  onChange({ ...value, toolAutonomy });
                }}
              >
                <SelectTrigger id={`${idPrefix}-${tool}`} className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Same as agent ({value.autonomy === "auto" ? "auto" : "draft only"})</SelectItem>
                  <SelectItem value="draft_only">Draft only</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Include this agent in the project's shared check-in. */
export function DigestSettings({
  value,
  onChange,
  idPrefix = "digest",
}: {
  value: Pick<ScopeFormState, "digestCadence" | "digestEmail" | "digestRecipients">;
  onChange: (next: Pick<ScopeFormState, "digestCadence" | "digestEmail" | "digestRecipients">) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-included`} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
        <Checkbox
          id={`${idPrefix}-included`}
          checked={value.digestCadence !== "off"}
          onCheckedChange={(included) => onChange({ ...value, digestCadence: included ? "weekly" : "off" })}
        />
        Include this agent in the team check-in
      </label>
      <p className="pl-6 text-xs leading-relaxed text-ink-muted">
        One project-wide summary covers the agents you include. Choose its timing and email delivery under Organization.
      </p>
    </div>
  );
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function parseObjectives(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function CadencePicker({
  cron,
  timezone,
  onChange,
}: {
  cron: string;
  timezone: string;
  onChange: (cron: string) => void;
}) {
  const cadence = cronToCadence(cron);
  const update = (next: Cadence) => onChange(cadenceToCron(next));
  const time = "hour" in cadence ? { hour: cadence.hour, minute: cadence.minute } : { hour: 9, minute: 0 };

  return (
    <div className="space-y-3">
      {/* Wraps on the column's width, not the viewport's: beside the chat preview
          the column is narrow even on a desktop screen. */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-40 flex-1">
          <Label htmlFor="cadence-kind">Cadence</Label>
          <Select
            value={cadence.kind}
            onValueChange={(kind) => {
              switch (kind) {
                case "hourly":
                  return update({ kind: "hourly" });
                case "daily":
                  return update({ kind: "daily", ...time });
                case "weekdays":
                  return update({ kind: "weekdays", ...time });
                case "weekly":
                  return update({ kind: "weekly", weekday: 1, ...time });
                default:
                  return update({ kind: "custom", cron });
              }
            }}
          >
            <SelectTrigger id="cadence-kind" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Every hour</SelectItem>
              <SelectItem value="daily">Every day</SelectItem>
              <SelectItem value="weekdays">Weekdays</SelectItem>
              <SelectItem value="weekly">Every week</SelectItem>
              <SelectItem value="custom">Custom cron</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {cadence.kind === "weekly" ? (
          <div>
            <Label htmlFor="cadence-weekday">On</Label>
            <Select
              value={String(cadence.weekday)}
              onValueChange={(v) => update({ ...cadence, weekday: Number(v) })}
            >
              <SelectTrigger id="cadence-weekday" className="mt-1.5 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {"hour" in cadence ? (
          <div>
            <Label htmlFor="cadence-hour">At</Label>
            <div className="mt-1.5 flex items-center gap-1">
              <Select
                value={String(cadence.hour)}
                onValueChange={(v) => update({ ...cadence, hour: Number(v) })}
              >
                <SelectTrigger id="cadence-hour" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-ink-muted">:</span>
              <Select
                value={String(cadence.minute)}
                onValueChange={(v) => update({ ...cadence, minute: Number(v) })}
              >
                <SelectTrigger aria-label="Minute" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(MINUTES.includes(cadence.minute) ? MINUTES : [cadence.minute, ...MINUTES]).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {String(m).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {cadence.kind === "custom" ? (
        <Field
          label="Cron expression"
          htmlFor="cadence-cron"
          hint="Five fields: minute hour day-of-month month day-of-week."
          error={
            cadence.cron.trim() && !looksLikeCron(cadence.cron)
              ? "That is not five cron fields. A weekly 9am run is 0 9 * * 1."
              : undefined
          }
        >
          <Input
            value={cadence.cron}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0 9 * * 1"
            className="font-mono"
          />
        </Field>
      ) : null}

      <div className="flex items-center gap-2 rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs">
        <Clock className="size-3.5 shrink-0 text-accent" aria-hidden />
        <span className="text-ink-muted">
          Runs <strong className="font-medium text-ink">{describeCadence(cron, timezone).toLowerCase()}</strong> in {timezone}.
        </span>
      </div>
    </div>
  );
}

/**
 * The scope of work, one setting at a time.
 *
 * Each section is exported on its own because the flow view opens exactly the
 * same control when a node is clicked - the same component, bound to the same
 * form state, writing the same record. Two views of one configuration, with
 * one implementation between them, so neither can drift from the other.
 */
interface ScopeSectionProps {
  value: ScopeFormState;
  onChange: (next: ScopeFormState) => void;
  fieldErrors?: Record<string, string[]>;
  idPrefix?: string;
}

function updater(props: ScopeSectionProps) {
  return <K extends keyof ScopeFormState>(key: K, next: ScopeFormState[K]) =>
    props.onChange({ ...props.value, [key]: next });
}

export function ContextSection({
  value,
  onChange,
  fieldErrors = {},
  idPrefix = "scope",
  contextDraft = null,
  inherited = null,
  heading = true,
}: ScopeSectionProps & {
  /** The "draft from my documents" control, wired by whoever can call the API. */
  contextDraft?: React.ReactNode;
  /** What this agent inherits from the project, shown above its own answers. */
  inherited?: React.ReactNode;
  heading?: boolean;
}) {
  const set = updater({ value, onChange });
  const agentQuestions = shownAgentQuestions(value.contextAnswers);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {heading ? (
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
              Context
              <HelpLink topic="agentContext" label="What makes good context?" />
            </h3>
            <p className="text-xs text-ink-muted">
              What this agent should know before every run. Short answers are fine; an example
              sits in each box.
            </p>
          </div>
        ) : null}
        {contextDraft}
      </div>

      {inherited}

      {agentQuestions.map((question) => {
        const options = choicesFor(question.id);
        return options ? (
          <ChoicePicker
            key={question.id}
            label={question.label}
            hint={question.hint}
            value={value.contextAnswers[question.id] ?? ""}
            onChange={(next) => set("contextAnswers", { ...value.contextAnswers, [question.id]: next })}
            options={options}
            idPrefix={`${idPrefix}-context-${question.id}`}
            otherPlaceholder={question.id === "stakeholders" ? "Names or anything else, e.g. Priya approves every post" : "Anything else that makes a good week"}
          />
        ) : (
          <ContextQuestions
            key={question.id}
            questions={[question]}
            value={value.contextAnswers}
            onChange={(next) => set("contextAnswers", next)}
            idPrefix={`${idPrefix}-context`}
            fieldErrors={fieldErrors}
          />
        );
      })}

      <ContextHelper
        answered={answeredCount(value.contextAnswers, agentQuestions)}
        total={agentQuestions.length}
      />
    </div>
  );
}

export function ObjectivesSection({
  value,
  onChange,
  fieldErrors = {},
  idPrefix = "scope",
  project,
  role,
}: ScopeSectionProps & {
  /** With both, "Write them for me" drafts goals from the job and its duties. */
  project?: string;
  role?: { jobTitle: string; responsibilities: string[] };
}) {
  const set = updater({ value, onChange });
  return (
    <ObjectivesEditor
      value={parseObjectives(value.objectivesText)}
      onChange={(next) => set("objectivesText", next.join("\n"))}
      idPrefix={idPrefix}
      project={project}
      role={role}
      error={fieldErrors.objectives?.[0]}
    />
  );
}

export function DocumentsSection({
  value,
  onChange,
  idPrefix = "scope",
  documents,
}: ScopeSectionProps & { documents: { id: string; filename: string }[] }) {
  const set = updater({ value, onChange });
  if (documents.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">Context documents</legend>
      <p className="text-xs text-ink-muted">
        Leave all unticked to let the agent search every document it has.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {documents.map((doc) => {
          const checked = value.documentIds.includes(doc.id);
          return (
            <label
              key={doc.id}
              htmlFor={`${idPrefix}-doc-${doc.id}`}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2"
            >
              <Checkbox
                id={`${idPrefix}-doc-${doc.id}`}
                checked={checked}
                onCheckedChange={(next) =>
                  set(
                    "documentIds",
                    next
                      ? [...value.documentIds, doc.id]
                      : value.documentIds.filter((id) => id !== doc.id),
                  )
                }
              />
              <span className="truncate">{doc.filename}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const GATED = new Set<string>(GATED_TOOL_IDS);

/** What a tool may do, in the owner's words. */
function permissionOf(tool: WorkToolId): string {
  if (GATED.has(tool)) return "Reaches outside Desker - asks you first";
  return {
    read: "Only reads",
    draft: "Writes drafts inside Desker",
    internal: "Plans its own next steps",
    external: "Reaches outside Desker",
  }[WORK_TOOL_RISK[tool]];
}

export function ToolsSection({
  value,
  onChange,
  idPrefix = "scope",
  /** The flow view opens this for one tool at a time. */
  only,
  roleTools,
  project,
}: ScopeSectionProps & {
  only?: WorkToolId;
  /** The role's own tools, shown first; everything else sits under More tools. */
  roleTools?: readonly string[];
  /** For whether what a tool needs is connected. */
  project?: string;
}) {
  const set = updater({ value, onChange });
  const integrations = useIntegrations(project ?? "");
  const connected = new Set((integrations.data ?? []).filter((row) => row.state !== "disconnected").map((row) => row.type));

  const toolCard = (tool: WorkToolId) => {
    const checked = value.tools.includes(tool);
    // Publishing goes to a connected network or the webhook: any one of them will do.
    const needs = tool === "publish_post" ? [...connectorsForTool("social_read"), ...connectorsForTool(tool)] : connectorsForTool(tool);
    const has = needs.find((connector) => connected.has(connector.id));
    const needsLabel = tool === "publish_post" ? "a social network or a publishing webhook" : needs.map((connector) => connector.name).join(" or ");
    return (
      <label
        key={tool}
        htmlFor={`${idPrefix}-tool-${tool}`}
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm text-ink transition-colors",
          checked ? "border-accent-line bg-accent-soft/30" : "border-line hover:bg-surface-2",
        )}
      >
        <Checkbox
          id={`${idPrefix}-tool-${tool}`}
          checked={checked}
          className="mt-0.5"
          onCheckedChange={(next) =>
            set(
              "tools",
              next
                ? WORK_TOOL_IDS.filter((id) => id === tool || value.tools.includes(id))
                : value.tools.filter((id) => id !== tool),
            )
          }
        />
        <span className="min-w-0 space-y-0.5">
          <span className="block font-medium">{WORK_TOOL_METADATA[tool].label}</span>
          <span className="block text-xs text-ink-muted">{WORK_TOOL_METADATA[tool].blurb}</span>
          <span className="block text-xs text-ink-muted">{permissionOf(tool)}</span>
          {needs.length > 0 ? (
            has ? (
              <span className="block text-xs text-positive">{has.name} connected</span>
            ) : project ? (
              <a
                href={`/p/${project}/integrations`}
                onClick={(event) => event.stopPropagation()}
                className="block text-xs font-medium text-accent hover:underline"
              >
                Needs {needsLabel} - connect
              </a>
            ) : (
              <span className="block text-xs text-ink-muted">Needs {needsLabel}</span>
            )
          ) : null}
        </span>
      </label>
    );
  };

  if (only) return <div className="grid gap-1.5">{toolCard(only)}</div>;

  const linked = CONNECTORS.filter((connector) => connector.status === "available" && connector.tools?.length && connected.has(connector.id));
  const primary = WORK_TOOL_IDS.filter((tool) => (roleTools ? roleTools.includes(tool) : false) || value.tools.includes(tool));
  const rest = WORK_TOOL_IDS.filter((tool) => !primary.includes(tool));

  return (
    <fieldset id={`${idPrefix}-tools`} className="scroll-mt-4 space-y-3">
      <div>
        <legend className="text-sm font-medium text-ink">Work tools</legend>
        <p className="mt-0.5 text-xs text-ink-muted">
          {roleTools ? "This role's own tools. " : ""}What it can use when it works on its own. Anything that reaches outside
          Desker waits for your approval unless you say otherwise under Trust.
        </p>
      </div>

      {linked.length > 0 ? (
        <div className="space-y-1.5 rounded-md border border-line p-3">
          <p className="text-sm font-medium text-ink">Connected tools this agent may use</p>
          {linked.map((connector) => {
            const tools = (connector.tools ?? []).filter((tool): tool is WorkToolId => (WORK_TOOL_IDS as readonly string[]).includes(tool));
            const on = tools.every((tool) => value.tools.includes(tool));
            return (
              <label key={connector.id} className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>{connector.name}</span>
                {/* ponytail: tools shared by two connectors (Gmail and Outlook) switch together; a per-connector choice needs its own column. */}
                <Switch
                  checked={on}
                  aria-label={`Let this agent use ${connector.name}`}
                  onCheckedChange={(next) =>
                    set(
                      "tools",
                      WORK_TOOL_IDS.filter((id) => (tools.includes(id) ? next : value.tools.includes(id))),
                    )
                  }
                />
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-1.5 sm:grid-cols-2">{primary.map(toolCard)}</div>

      {rest.length > 0 ? (
        <details className="rounded-md border border-line">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2/60">
            More tools <span className="font-normal text-ink-muted">· {rest.length} not used by this role</span>
          </summary>
          <div className="grid gap-1.5 border-t border-line p-3 sm:grid-cols-2">{rest.map(toolCard)}</div>
        </details>
      ) : null}

      {value.tools.length === 0 ? (
        <p className="text-xs text-warning">With no tools it can only write a summary. Tick at least one.</p>
      ) : null}
    </fieldset>
  );
}

export function TriggerSection({
  value,
  onChange,
  fieldErrors = {},
  idPrefix = "scope",
  webhookUrl,
}: ScopeSectionProps & { webhookUrl?: string | null }) {
  const set = updater({ value, onChange });
  return (
    <div id={`${idPrefix}-trigger`} className="scroll-mt-4 space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-trigger`}>When it runs</Label>
        <Select
          value={value.triggerType}
          onValueChange={(next) => set("triggerType", next as TriggerType)}
        >
          <SelectTrigger id={`${idPrefix}-trigger`} className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Only when I run it</SelectItem>
            <SelectItem value="cron">On a schedule</SelectItem>
            <SelectItem value="webhook">When an event arrives (webhook)</SelectItem>
          </SelectContent>
        </Select>
        {fieldErrors.cron?.[0] ? (
          <p className="mt-1.5 text-xs text-danger">{fieldErrors.cron[0]}</p>
        ) : null}
      </div>

      {value.triggerType === "cron" ? (
        <div className="space-y-3 rounded-lg border border-line bg-surface-2/60 p-4">
          <CadencePicker
            cron={value.cron}
            timezone={value.timezone}
            onChange={(cron) => set("cron", cron)}
          />
          <Field
            label="Time zone"
            htmlFor={`${idPrefix}-timezone`}
            hint="An IANA name, e.g. Europe/London or America/New_York."
            error={fieldErrors.timezone?.[0]}
          >
            <Input
              id={`${idPrefix}-timezone`}
              value={value.timezone}
              onChange={(event) => set("timezone", event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {value.triggerType === "webhook" ? (
        <div className="space-y-2 rounded-lg border border-line bg-surface-2/60 p-4 text-sm">
          {webhookUrl ? (
            <>
              <p className="text-ink">POST JSON to this URL to start a run:</p>
              <code className="block overflow-x-auto rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-xs text-ink">
                {webhookUrl}
              </code>
              <p className="text-xs text-ink-muted">
                The body is handed to the agent as the event it should act on. Keep the URL
                private: it is the whole credential.{" "}
                <HelpLink topic="webhookTrigger" label="How do webhook triggers work?" />
              </p>
            </>
          ) : (
            <p className="text-ink-muted">
              A private webhook URL is generated when the agent is created. Any system that
              can POST JSON - Zapier, a form tool, your own code - can start a run.
            </p>
          )}
        </div>
      ) : null}

      {value.triggerType !== "manual" ? (
        <label
          htmlFor={`${idPrefix}-enabled`}
          className="flex cursor-pointer items-center gap-2 text-sm text-ink"
        >
          <Checkbox
            id={`${idPrefix}-enabled`}
            checked={value.enabled}
            onCheckedChange={(next) => set("enabled", Boolean(next))}
          />
          Trigger is active
        </label>
      ) : null}
    </div>
  );
}

export function ScopeOfWorkForm({
  value,
  onChange,
  documents = [],
  fieldErrors = {},
  webhookUrl,
  idPrefix = "scope",
  showModeNote = true,
  contextDraft = null,
  inherited = null,
  project,
  roleTools,
  role,
}: {
  value: ScopeFormState;
  onChange: (next: ScopeFormState) => void;
  /** The agent's ready documents, for linking. Omitted in the wizard. */
  documents?: { id: string; filename: string }[];
  fieldErrors?: Record<string, string[]>;
  /** Shown once the agent exists and the trigger is a webhook. */
  webhookUrl?: string | null;
  idPrefix?: string;
  /** The wizard explains draft-only mode; the editor has the trust controls instead. */
  showModeNote?: boolean;
  contextDraft?: React.ReactNode;
  inherited?: React.ReactNode;
  /** For connection status and "Write them for me". */
  project?: string;
  /** The role's own tools (its template's), shown first. */
  roleTools?: readonly string[];
  /** The job and duties goals are written from. */
  role?: { jobTitle: string; responsibilities: string[] };
}) {
  const section = { value, onChange, fieldErrors, idPrefix };
  return (
    <div className="space-y-5">
      {/* When it runs comes first: it decides whether the agent works on its own at all. */}
      <TriggerSection {...section} webhookUrl={webhookUrl} />
      <ObjectivesSection {...section} project={project} role={role} />
      <ContextSection {...section} contextDraft={contextDraft} inherited={inherited} />
      <DocumentsSection {...section} documents={documents} />
      <ToolsSection {...section} roleTools={roleTools} project={project} />

      {showModeNote ? (
        <p className="rounded-lg border border-accent-line bg-accent-soft/40 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <strong className="font-medium text-ink">Draft-only mode.</strong> Research and drafts
          run on their own. Anything that would publish a post or send an email stops and waits
          for your approval in Needs you. Every agent starts this way; you can extend trust in the
          editor once it has earned it.
        </p>
      ) : null}
    </div>
  );
}
