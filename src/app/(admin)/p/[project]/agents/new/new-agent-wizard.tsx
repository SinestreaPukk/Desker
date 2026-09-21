"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { AvatarPicker } from "@/components/builder/avatar-picker";
import { EscalationRuleHelper } from "@/components/builder/live-example";
import {
  ScopeOfWorkForm,
  defaultScopeForm,
  parseObjectives,
  type ScopeFormState,
} from "@/components/builder/scope-of-work-form";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { useCreateAgent } from "@/hooks/use-admin-data";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { parseLines } from "@/lib/agent-fields";
import { TOOL_IDS, type ToolId } from "@/lib/tools/registry";
import { TEMPLATES, templateById, type AgentTemplate } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { WORK_TOOL_IDS } from "@/lib/work/tools";
import { cn } from "@/lib/utils";

/**
 * The role templates come from content/templates.json - the same records the
 * public showcase renders - plus one blank card. Picking one pre-fills every
 * field; nothing is locked, the admin edits whatever they like afterwards.
 */
const SCRATCH = "scratch";

const STEPS = ["Pick a role", "Who they are", "How they behave", "What they can do"] as const;

/**
 * The one chat capability the wizard exposes. Everything else in the chat
 * tool set (logging issues, escalating, transferring) stays on by default and
 * is adjusted in the editor. The rest of this step is the scope of work: what
 * the agent does when nobody is talking to it.
 */
const CONTEXT_TOOL: ToolId = "search_company_context";

export function NewAgentWizard({ project }: { project: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const create = useCreateAgent(project);

  // A showcase link (/signup?template=x) arrives here with the role chosen.
  const preselected = search.get("template");
  const initial = preselected ? templateById(preselected) : undefined;

  const [step, setStep] = React.useState(initial ? 1 : 0);
  const [template, setTemplate] = React.useState<string | null>(initial ? initial.id : null);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [form, setForm] = React.useState(() => formFromTemplate(initial));
  const answersFromDocuments = form.allowedTools.includes(CONTEXT_TOOL);
  const [scope, setScope] = React.useState<ScopeFormState>(() => scopeFromTemplate(initial));
  // The scope of work is its own record; an untouched default one is not
  // worth saving, but a template's tool set is.
  const scopeTouched =
    scope.context.trim() !== "" ||
    scope.objectivesText.trim() !== "" ||
    scope.triggerType !== "manual" ||
    scope.tools.length !== WORK_TOOL_IDS.length;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function pickTemplate(id: string) {
    const preset = id === SCRATCH ? undefined : templateById(id);
    setTemplate(id);
    // Name and avatar are the admin's own; a new role swaps everything else.
    setForm((current) => ({ ...formFromTemplate(preset), name: current.name, avatarUrl: current.avatarUrl }));
    setScope((current) => ({ ...scopeFromTemplate(preset), context: current.context, objectivesText: current.objectivesText }));
  }

  const stepValid = [
    template !== null,
    form.name.trim() && form.jobTitle.trim(),
    form.personality.trim().length >= 10,
    true,
  ][step];

  async function submit() {
    setError(null);
    setFieldErrors({});
    try {
      const agent = await create.mutateAsync({
        name: form.name.trim(),
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        avatarUrl: form.avatarUrl ?? "",
        personality: form.personality.trim(),
        responsibilities: parseLines(form.responsibilitiesText),
        allowedTools: form.allowedTools,
        escalationRule: form.escalationRule.trim(),
        welcomeMessage: form.welcomeMessage.trim(),
        status: "draft",
      });
      if (scopeTouched) {
        try {
          await api(`/api/agents/${agent.id}/scope`, {
            method: "PUT",
            body: JSON.stringify({
              context: scope.context.trim(),
              objectives: parseObjectives(scope.objectivesText),
              documentIds: [],
              triggerType: scope.triggerType,
              cron: scope.triggerType === "cron" ? scope.cron : null,
              timezone: scope.timezone,
              enabled: scope.enabled,
              autonomy: "draft_only",
              toolAutonomy: null,
              tools: scope.tools,
            }),
          });
        } catch (caught) {
          // The agent exists; the editor shows the same form to fix it there.
          if (caught instanceof ApiError) {
            setError(`${caught.message} The agent was created - finish its scope of work in the editor.`);
            setFieldErrors(caught.fieldErrors ?? {});
            return;
          }
        }
      }
      router.push(`/p/${project}/agents/${agent.id}?onboarding=1`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
        // Send the admin back to the step that owns the bad field.
        const fields = Object.keys(caught.fieldErrors ?? {});
        if (fields.some((field) => ["name", "jobTitle", "avatarUrl"].includes(field))) setStep(1);
        else if (
          fields.some((field) =>
            ["personality", "welcomeMessage", "escalationRule"].includes(field),
          )
        )
          setStep(2);
      } else {
        setError(errorMessage(caught));
      }
    }
  }

  return (
    <div className="paper-grid min-h-full">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
          <Link href={`/p/${project}/roster`}>
            <ArrowLeft aria-hidden />
            Roster
          </Link>
        </Button>

        <h1 className="text-xl font-semibold text-ink">Hire an AI employee</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Pick a role, give them a name, check how they behave. About five minutes,
          then you&apos;ll add a document and publish.
        </p>

        {/* Progress */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-accent text-accent-fg",
                    current && "border-2 border-accent text-accent",
                    !done && !current && "border border-line-strong text-ink-subtle",
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-xs sm:block",
                    current ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px flex-1",
                      done ? "bg-accent" : "bg-line",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <Panel className="mt-5">
          <PanelHeader>
            <div>
              <PanelTitle>{STEPS[step]}</PanelTitle>
              <PanelDescription>
                {
                  [
                    "Every field below is pre-filled from the role you pick. Change anything.",
                    "Give them a name, a job and a face. Clients see all three.",
                    "How they talk, what falls to them, and when they fetch a human.",
                    "What they can draw on, and what they do on their own.",
                  ][step]
                }
              </PanelDescription>
            </div>
          </PanelHeader>

          <PanelBody className="space-y-5">
            <FormError message={error} />

            {step === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.map((role) => (
                  <TemplateCard
                    key={role.id}
                    selected={template === role.id}
                    onSelect={() => pickTemplate(role.id)}
                    icon={<TemplateIcon icon={role.icon} className="size-4" />}
                    title={role.name}
                    subtitle={role.jobTitle}
                    body={role.pitch}
                  />
                ))}
                <TemplateCard
                  selected={template === SCRATCH}
                  onSelect={() => pickTemplate(SCRATCH)}
                  icon={<PenLine className="size-4" />}
                  title="Start from scratch"
                  subtitle="Blank"
                  body="Every field empty. Best when none of the roles is close to the job."
                />
              </div>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Name"
                    htmlFor="name"
                    required
                    error={fieldErrors.name?.[0]}
                  >
                    <Input
                      value={form.name}
                      autoFocus
                      onChange={(event) => set("name", event.target.value)}
                      placeholder="Mia"
                    />
                  </Field>
                  <Field
                    label="Job title"
                    htmlFor="jobTitle"
                    required
                    error={fieldErrors.jobTitle?.[0]}
                  >
                    <Input
                      value={form.jobTitle}
                      onChange={(event) => set("jobTitle", event.target.value)}
                      placeholder="Customer Support Lead"
                    />
                  </Field>
                </div>

                <Field label="Team" htmlFor="department" hint="Optional.">
                  <Input
                    value={form.department}
                    onChange={(event) => set("department", event.target.value)}
                    placeholder="Customer Experience"
                  />
                </Field>

                <div className="space-y-2">
                  <Label>Avatar</Label>
                  {/* Until a face is picked, the default follows the name - so
                      remount when it changes and the swatches stay in step
                      with the preview. */}
                  <AvatarPicker
                    key={form.avatarUrl ?? `auto:${form.name}`}
                    name={form.name}
                    value={form.avatarUrl}
                    onChange={(next) => set("avatarUrl", next)}
                  />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Field
                  label="Personality and tone"
                  htmlFor="personality"
                  required
                  error={fieldErrors.personality?.[0]}
                  hint="At least a sentence. This goes into the system prompt word for word."
                >
                  <Textarea
                    value={form.personality}
                    autoFocus
                    rows={5}
                    onChange={(event) => set("personality", event.target.value)}
                    placeholder="Warm but efficient. Gets to the point in two sentences and says plainly when something isn't possible."
                  />
                </Field>

                <Field
                  label="Responsibilities"
                  htmlFor="responsibilities"
                  hint="One per line. Anything not listed is out of scope."
                >
                  <Textarea
                    value={form.responsibilitiesText}
                    rows={4}
                    onChange={(event) =>
                      set("responsibilitiesText", event.target.value)
                    }
                    placeholder={"Answer order and return questions\nLog bugs clients report"}
                  />
                </Field>

                <Field
                  label="Opening message"
                  htmlFor="welcomeMessage"
                  hint="Optional. The first thing a client sees."
                >
                  <Textarea
                    value={form.welcomeMessage}
                    rows={2}
                    onChange={(event) => set("welcomeMessage", event.target.value)}
                    placeholder="Hi, I'm Mia. What can I help with?"
                  />
                </Field>

                <Field
                  label="Escalation rule"
                  htmlFor="escalationRule"
                  hint="Plain language. The model judges it from the conversation; nothing is keyword-matched."
                >
                  <Textarea
                    value={form.escalationRule}
                    rows={3}
                    onChange={(event) => set("escalationRule", event.target.value)}
                    placeholder="Escalate if the client is angry, asks for a refund over $200, or mentions legal action."
                  />
                </Field>
                <EscalationRuleHelper
                  value={form.escalationRule}
                  onPick={(text) => set("escalationRule", text)}
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors",
                    answersFromDocuments
                      ? "border-accent-line bg-accent-soft/40"
                      : "border-line",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <div>
                      <Label htmlFor="answers-from-documents" className="text-sm">
                        Answer from context documents
                      </Label>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                        Upload policies, product sheets or FAQs after this step. The agent
                        searches them before answering and cites what it found instead of
                        guessing.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="answers-from-documents"
                    checked={answersFromDocuments}
                    onCheckedChange={(next) =>
                      set(
                        "allowedTools",
                        next
                          ? [...form.allowedTools, CONTEXT_TOOL]
                          : form.allowedTools.filter((tool) => tool !== CONTEXT_TOOL),
                      )
                    }
                  />
                </div>

                <p className="text-xs leading-relaxed text-ink-muted">
                  Logging issues and suggestions, and escalating to a human, are on by
                  default. Adjust those in the editor once the agent exists.
                </p>

                <div className="border-t border-line pt-5">
                  <h3 className="text-base font-semibold text-ink">Scope of work</h3>
                  <p className="mb-4 mt-0.5 text-xs leading-relaxed text-ink-muted">
                    Optional now, editable later. What this agent does on its own - on a
                    schedule, or when an event arrives - and what it should know while doing
                    it.
                  </p>
                  <ScopeOfWorkForm value={scope} onChange={setScope} idPrefix="new-scope" />
                </div>
              </>
            ) : null}
          </PanelBody>

          <PanelFooter>
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setStep((current) => current - 1)}
                className="mr-auto"
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>
            ) : null}

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((current) => current + 1)}
                disabled={!stepValid}
              >
                Continue
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => void submit()} loading={create.isPending}>
                Create agent
                <ArrowRight aria-hidden />
              </Button>
            )}
          </PanelFooter>
        </Panel>
      </div>
    </div>
  );
}

function formFromTemplate(preset: AgentTemplate | undefined) {
  return {
    name: "",
    jobTitle: preset?.jobTitle ?? "",
    department: preset?.team ?? "",
    avatarUrl: null as string | null,
    personality: preset?.personality ?? "",
    responsibilitiesText: preset?.responsibilities.join("\n") ?? "",
    escalationRule: preset?.escalationRule ?? "",
    welcomeMessage: preset?.welcomeMessage ?? "",
    allowedTools: (preset ? [...preset.allowedTools] : [...TOOL_IDS]) as ToolId[],
  };
}

function scopeFromTemplate(preset: AgentTemplate | undefined): ScopeFormState {
  return { ...defaultScopeForm(), tools: preset ? [...preset.workTools] : [...WORK_TOOL_IDS] };
}

function TemplateCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-accent text-accent-fg" : "bg-surface-2 text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{subtitle}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{body}</span>
      </span>
    </button>
  );
}
