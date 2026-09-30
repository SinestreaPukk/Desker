"use client";

import * as React from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api-client";
import {
  ESCALATION_OPTIONS,
  composeChoices,
  composeEscalation,
  parseChoices,
  parseEscalation,
  type Choices,
} from "@/lib/work/agent-choices";
import type { SpaceKind } from "@/lib/space";
import { cn } from "@/lib/utils";

/**
 * Setting an agent up by ticking rather than writing: its duties, when it
 * stops and asks, who is involved, what a good week looks like, and goals it
 * can write for itself. Everything still lands in the same fields as before,
 * as plain sentences the agent reads.
 */

function TickRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm text-ink transition-colors",
        checked ? "border-accent-line bg-accent-soft/30" : "border-line hover:bg-surface-2",
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} className="mt-0.5" />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

/** A one-line "add your own" with an Add button; Enter adds too. */
function AddOwn({ id, placeholder, onAdd }: { id: string; placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = React.useState("");
  const add = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Input
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
      />
      <Button type="button" variant="secondary" onClick={add} disabled={!text.trim()}>
        <Plus aria-hidden />
        Add
      </Button>
    </div>
  );
}

// --- duties -----------------------------------------------------------------------

/** The role's usual duties ticked, more offered unticked, and any of the owner's own. */
export function ResponsibilitiesPicker({
  value,
  onChange,
  options,
  idPrefix,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
  idPrefix: string;
}) {
  const own = value.filter((item) => !options.includes(item));
  const all = [...options, ...own];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">What it looks after</legend>
      <p className="text-xs text-ink-muted">Tick what&apos;s its job. Anything left unticked is out of scope.</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {all.map((item, index) => (
          <TickRow
            key={item}
            id={`${idPrefix}-duty-${index}`}
            label={item}
            checked={value.includes(item)}
            onChange={(next) => onChange(next ? all.filter((row) => row === item || value.includes(row)) : value.filter((row) => row !== item))}
          />
        ))}
      </div>
      <AddOwn id={`${idPrefix}-duty-own`} placeholder="Add a duty of your own" onAdd={(text) => !value.includes(text) && onChange([...value, text])} />
    </fieldset>
  );
}

// --- when it stops and asks -------------------------------------------------------------

export function EscalationPicker({
  value,
  onChange,
  kind,
  idPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  kind: SpaceKind;
  idPrefix: string;
}) {
  const choices = parseEscalation(value, kind);
  const set = (next: Choices) => onChange(composeEscalation(next));
  const options = ESCALATION_OPTIONS[kind];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">Stop and ask me when…</legend>
      <p className="text-xs text-ink-muted">
        It judges these from what&apos;s actually happening, not from keywords. When one applies it hands the matter to you in
        Needs you.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((option, index) => (
          <TickRow
            key={option}
            id={`${idPrefix}-esc-${index}`}
            label={option.charAt(0).toUpperCase() + option.slice(1)}
            checked={choices.selected.includes(option)}
            onChange={(next) =>
              set({
                ...choices,
                selected: next
                  ? options.filter((row) => row === option || choices.selected.includes(row))
                  : choices.selected.filter((row) => row !== option),
              })
            }
          />
        ))}
      </div>
      <label htmlFor={`${idPrefix}-esc-other`} className="block text-xs text-ink-muted">
        Anything else
      </label>
      <Textarea
        id={`${idPrefix}-esc-other`}
        rows={2}
        value={choices.other}
        onChange={(event) => set({ ...choices, other: event.target.value })}
        placeholder={kind === "personal" ? "e.g. it's about my children's school" : "e.g. a refund over $200"}
      />
    </fieldset>
  );
}

// --- tick-the-ones-that-apply answers ----------------------------------------------------------

export function ChoicePicker({
  label,
  hint,
  value,
  onChange,
  options,
  idPrefix,
  otherPlaceholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  idPrefix: string;
  otherPlaceholder: string;
}) {
  const choices = parseChoices(value, options);
  const set = (next: Choices) => onChange(composeChoices(next));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = choices.selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() =>
                set({
                  ...choices,
                  selected: on ? choices.selected.filter((row) => row !== option) : options.filter((row) => row === option || choices.selected.includes(row)),
                })
              }
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on ? "border-accent-line bg-accent-soft font-medium text-accent-soft-fg" : "border-line text-ink hover:bg-surface-2",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <label htmlFor={`${idPrefix}-other`} className="sr-only">
        {otherPlaceholder}
      </label>
      <Input id={`${idPrefix}-other`} value={choices.other} onChange={(event) => set({ ...choices, other: event.target.value })} placeholder={otherPlaceholder} />
    </fieldset>
  );
}

// --- goals ---------------------------------------------------------------------------------

/** Its goals as a list, pre-written from the role, with a button that writes them from its duties. */
export function ObjectivesEditor({
  value,
  onChange,
  idPrefix,
  project,
  role,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
  project?: string;
  /** What the writer goes on: the job and its ticked duties. */
  role?: { jobTitle: string; responsibilities: string[] };
  error?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  async function writeForMe() {
    if (!project || !role) return;
    setFailed(null);
    setBusy(true);
    try {
      const { objectives } = await api<{ objectives: string[] }>(`/api/agents/objectives?project=${encodeURIComponent(project)}`, {
        method: "POST",
        body: JSON.stringify(role),
      });
      if (objectives.length) onChange(objectives);
    } catch (caught) {
      setFailed(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <legend className="text-sm font-medium text-ink">Its goals</legend>
          <p className="text-xs text-ink-muted">What each run should achieve, concretely. It checks its work against these.</p>
        </div>
        {project && role ? (
          <Button type="button" size="sm" variant="secondary" loading={busy} disabled={!role.jobTitle.trim()} onClick={() => void writeForMe()}>
            <Sparkles aria-hidden />
            {value.length ? "Rewrite them for me" : "Write them for me"}
          </Button>
        ) : null}
      </div>
      <FormError message={failed ?? error ?? null} />
      {value.length > 0 ? (
        <ol className="space-y-1.5">
          {value.map((objective, index) => (
            <li key={`${index}-${objective}`} className="flex items-start gap-2">
              <span className="mt-2 w-4 shrink-0 text-right text-xs text-ink-muted">{index + 1}.</span>
              <label htmlFor={`${idPrefix}-goal-${index}`} className="sr-only">
                Goal {index + 1}
              </label>
              <Input
                id={`${idPrefix}-goal-${index}`}
                value={objective}
                onChange={(event) => onChange(value.map((row, i) => (i === index ? event.target.value : row)))}
              />
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove goal ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          No goals yet{project && role ? " - press Write them for me, or add one below." : " - add one below."}
        </p>
      )}
      <AddOwn id={`${idPrefix}-goal-own`} placeholder="Add a goal" onAdd={(text) => onChange([...value, text])} />
    </fieldset>
  );
}
