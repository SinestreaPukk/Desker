"use client";

import * as React from "react";
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
import type { TriggerType } from "@/lib/work/types";

/** What the form edits. Objectives are one per line until they are saved. */
export interface ScopeFormState {
  context: string;
  objectivesText: string;
  documentIds: string[];
  triggerType: TriggerType;
  cron: string;
  timezone: string;
  enabled: boolean;
}

export function defaultScopeForm(): ScopeFormState {
  return {
    context: "",
    objectivesText: "",
    documentIds: [],
    triggerType: "manual",
    cron: "0 9 * * 1",
    timezone: browserTimezone(),
    enabled: true,
  };
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
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
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
        >
          <Input
            value={cadence.cron}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0 9 * * 1"
            className="font-mono"
          />
        </Field>
      ) : null}

      <p className="text-xs text-ink-muted">{describeCadence(cron, timezone)}</p>
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
}: {
  value: ScopeFormState;
  onChange: (next: ScopeFormState) => void;
  /** The agent's ready documents, for linking. Omitted in the wizard. */
  documents?: { id: string; filename: string }[];
  fieldErrors?: Record<string, string[]>;
  /** Shown once the agent exists and the trigger is a webhook. */
  webhookUrl?: string | null;
  idPrefix?: string;
}) {
  const set = <K extends keyof ScopeFormState>(key: K, next: ScopeFormState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-5">
      <Field
        label="Project context"
        htmlFor={`${idPrefix}-context`}
        hint="What the agent should know before every run: the product, the audience, this quarter's push, house style."
        error={fieldErrors.context?.[0]}
      >
        <Textarea
          id={`${idPrefix}-context`}
          value={value.context}
          rows={4}
          onChange={(event) => set("context", event.target.value)}
          placeholder="We sell hand tools to professional tradespeople. This month we're pushing the lifetime warranty. Tone: plain, confident, no hype."
        />
      </Field>

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

      {documents.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-[0.8125rem] font-medium text-ink">Context documents</legend>
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
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-[0.8125rem] text-ink hover:bg-surface-2"
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
      ) : null}

      <div className="space-y-3">
        <div>
          <Label htmlFor={`${idPrefix}-trigger`}>Trigger</Label>
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
          <div className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-4">
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
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-4 text-[0.8125rem]">
            {webhookUrl ? (
              <>
                <p className="text-ink">POST JSON to this URL to start a run:</p>
                <code className="block overflow-x-auto rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs text-ink">
                  {webhookUrl}
                </code>
                <p className="text-xs text-ink-muted">
                  The body is handed to the agent as the event it should act on. Keep the URL
                  private: it is the whole credential.
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
            className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-ink"
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

      <p className="rounded-xl border border-accent-line bg-accent-soft/40 px-3 py-2 text-xs leading-relaxed text-ink-muted">
        <strong className="font-medium text-ink">Draft-only mode.</strong> Research and drafts
        run on their own. Anything that would publish a post or send an email stops and waits
        for your approval under <em>Work</em>. Every agent starts this way.
      </p>
    </div>
  );
}
