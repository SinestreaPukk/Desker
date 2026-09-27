"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
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
  DIGEST_CADENCES,
  DIGEST_CADENCE_LABELS,
  type AutonomyMode,
  type DigestCadence,
  type ToolAutonomy,
  type TriggerType,
} from "@/lib/work/types";
import { ContextHelper, ObjectivesHelper } from "./live-example";
import { ContextQuestions } from "./context-questions";
import { badRecipients, looksLikeCron } from "@/lib/form-errors";
import { HelpLink } from "@/components/help/help-panel";
import {
  AGENT_CONTEXT_QUESTIONS,
  answeredCount,
  type ContextAnswers,
} from "@/lib/work/context";
import {
  GATED_TOOLS,
  WORK_TOOL_IDS,
  WORK_TOOL_METADATA,
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

/**
 * How the agent keeps its owner posted. Editor-only, like Trust: a new agent
 * gets the weekly default and nobody has to decide this while hiring.
 */
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
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-cadence`}>Send me an update</Label>
        <Select
          value={value.digestCadence}
          onValueChange={(next) => onChange({ ...value, digestCadence: next as DigestCadence })}
        >
          <SelectTrigger id={`${idPrefix}-cadence`} className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIGEST_CADENCES.map((cadence) => (
              <SelectItem key={cadence} value={cadence}>
                {DIGEST_CADENCE_LABELS[cadence]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-ink-muted">
          A few lines in the Inbox&apos;s Updates tab: what got done, what is waiting on you, and
          anything this agent thinks you should know. A period with nothing in it sends nothing.
        </p>
      </div>

      {value.digestCadence === "off" ? null : (
        <>
          <label
            htmlFor={`${idPrefix}-email`}
            className="flex cursor-pointer items-center gap-2 text-sm text-ink"
          >
            <Checkbox
              id={`${idPrefix}-email`}
              checked={value.digestEmail}
              onCheckedChange={(next) => onChange({ ...value, digestEmail: Boolean(next) })}
            />
            Email it as well
          </label>

          {value.digestEmail ? (
            <Field
              label="Send to"
              htmlFor={`${idPrefix}-recipients`}
              hint="Comma-separated. Leave it empty to send to this organisation's owners and admins."
              error={
                badRecipients(value.digestRecipients).length > 0
                  ? `${badRecipients(value.digestRecipients)[0]} is not an email address. Separate addresses with a comma.`
                  : undefined
              }
            >
              <Input
                id={`${idPrefix}-recipients`}
                value={value.digestRecipients}
                onChange={(event) => onChange({ ...value, digestRecipients: event.target.value })}
                placeholder="you@example.com, ops@example.com"
              />
            </Field>
          ) : null}
        </>
      )}
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

      <ContextQuestions
        questions={AGENT_CONTEXT_QUESTIONS}
        value={value.contextAnswers}
        onChange={(next) => set("contextAnswers", next)}
        idPrefix={`${idPrefix}-context`}
        fieldErrors={fieldErrors}
      />

      <ContextHelper
        answered={answeredCount(value.contextAnswers, AGENT_CONTEXT_QUESTIONS)}
        total={AGENT_CONTEXT_QUESTIONS.length}
      />
    </div>
  );
}

export function ObjectivesSection({
  value,
  onChange,
  fieldErrors = {},
  idPrefix = "scope",
}: ScopeSectionProps) {
  const set = updater({ value, onChange });
  return (
    <div className="space-y-5">
      <Field
        label="Objectives"
        htmlFor={`${idPrefix}-objectives`}
        hint="One per line. What a run should achieve, concretely."
        error={fieldErrors.objectives?.[0]}
      >
        <Textarea
          id={`${idPrefix}-objectives`}
          value={value.objectivesText}
          rows={4}
          onChange={(event) => set("objectivesText", event.target.value)}
          placeholder={
            "Research what competitors announced this week\nDraft a LinkedIn post about the warranty\nEmail the summary to marketing@example.com"
          }
        />
      </Field>
      <ObjectivesHelper
        objectives={parseObjectives(value.objectivesText)}
        onPick={(text) => set("objectivesText", value.objectivesText ? `${value.objectivesText}\n${text}` : text)}
      />
    </div>
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

const RESEARCH_TOOLS = ["search_documents", "web_research", "draft_content"] as const;
const ACTION_TOOLS = ["publish_post", "send_email", "schedule_followup", "escalate_to_human"] as const;

export function ToolsSection({
  value,
  onChange,
  idPrefix = "scope",
  /** The flow view opens this for one tool at a time. */
  only,
}: ScopeSectionProps & { only?: WorkToolId }) {
  const set = updater({ value, onChange });

  const toolCard = (tool: WorkToolId) => {
    const checked = value.tools.includes(tool);
    return (
      <label
        key={tool}
        htmlFor={`${idPrefix}-tool-${tool}`}
        className={cn(
          "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm text-ink transition-colors",
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
        <span className="min-w-0">
          <span className="block font-medium">{WORK_TOOL_METADATA[tool].label}</span>
          <span className="block text-xs text-ink-muted">{WORK_TOOL_METADATA[tool].blurb}</span>
        </span>
      </label>
    );
  };

  if (only) return <div className="grid gap-1.5">{toolCard(only)}</div>;

  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-sm font-medium text-ink">Work tools</legend>
        <p className="mt-0.5 text-xs text-ink-muted">
          What the agent can do during a run. Publishing and email still wait for approval
          unless you say otherwise.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Research &amp; Drafting
        </span>
        <div className="grid gap-1.5 sm:grid-cols-2">{RESEARCH_TOOLS.map(toolCard)}</div>
      </div>

      <div className="space-y-1.5 pt-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Actions &amp; Escalation (Guarded)
        </span>
        <div className="grid gap-1.5 sm:grid-cols-2">{ACTION_TOOLS.map(toolCard)}</div>
      </div>

      {value.tools.length === 0 ? (
        <p className="text-xs text-warning">
          With no tools the agent can only write a summary. Tick at least one.
        </p>
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
    <div className="space-y-3">
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
}) {
  const section = { value, onChange, fieldErrors, idPrefix };
  return (
    <div className="space-y-5">
      {/* When it runs comes first: it decides whether the agent works on its own at all. */}
      <TriggerSection {...section} webhookUrl={webhookUrl} />
      <ObjectivesSection {...section} />
      <ContextSection {...section} contextDraft={contextDraft} inherited={inherited} />
      <DocumentsSection {...section} documents={documents} />
      <ToolsSection {...section} />

      {showModeNote ? (
        <p className="rounded-lg border border-accent-line bg-accent-soft/40 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <strong className="font-medium text-ink">Draft-only mode.</strong> Research and drafts
          run on their own. Anything that would publish a post or send an email stops and waits
          for your approval in the Inbox. Every agent starts this way; you can extend trust in the
          editor once it has earned it.
        </p>
      ) : null}
    </div>
  );
}
