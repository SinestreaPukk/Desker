"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { AvatarPicker } from "@/components/builder/avatar-picker";
import { InheritedProjectContext } from "@/components/builder/context-questions";
import { EscalationPicker, ResponsibilitiesPicker } from "@/components/builder/agent-setup";
import {
  ContextSection,
  ObjectivesSection,
  ToolsSection,
  TriggerSection,
  defaultScopeForm,
  parseObjectives,
  type ScopeFormState,
} from "@/components/builder/scope-of-work-form";
import { Panel, PanelBody, PanelDescription, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { useCreateAgent } from "@/hooks/use-admin-data";
import { api, ApiError, errorMessage } from "@/lib/shared/api-client";
import { randomAgentName } from "@/lib/agents/agent-fields";
import type { ToolId } from "@/lib/tools/registry";
import { templateById, TEMPLATES, type AgentTemplate } from "@/lib/site/content";
import { SPACE_COPY as copy } from "@/lib/tenancy/space-copy";
import { TemplateIcon, ScratchCuteIcon } from "@/components/marketing/template-icon";
import { AGENT_CONTEXT_QUESTIONS } from "@/lib/work/context";
import type { WorkToolId } from "@/lib/work/tools";
import type { TriggerType } from "@/lib/work/types";
import { cn } from "@/lib/shared/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

/**
 * Hiring in two steps: pick a role, then one page to make it yours - its
 * name, what it looks after, when it stops and asks, its goals, when it
 * works and its tools, all pre-filled from the role and changed by ticking.
 * No voice to write (the role brings one), no documents or connections to
 * sort out first: those come on the agent's own page, when they matter.
 */
const SCRATCH = "scratch";

/** A blank agent still starts able to do something useful, and nothing that reaches outside. */
const SCRATCH_TOOLS: WorkToolId[] = ["search_documents", "web_research", "draft_content", "schedule_followup", "escalate_to_human"];

/** In chat it can always search what it was given; the rest follow the role. */
const CHAT_TOOL: ToolId = "search_documents";

interface HireForm {
  name: string;
  jobTitle: string;
  department: string;
  avatarUrl: string | null;
  responsibilities: string[];
  escalationRule: string;
}

function formFrom(preset: AgentTemplate | undefined, name?: string): HireForm {
  return {
    name: name ?? randomAgentName(),
    jobTitle: preset?.jobTitle ?? "",
    department: preset?.team ?? "",
    avatarUrl: null,
    responsibilities: preset ? [...preset.responsibilities] : [],
    escalationRule: preset?.escalationRule ?? "",
  };
}

function scopeFrom(preset: AgentTemplate | undefined): ScopeFormState {
  const base = defaultScopeForm();
  if (!preset) return { ...base, tools: SCRATCH_TOOLS };
  return {
    ...base,
    contextAnswers: preset.defaultContext ? { [AGENT_CONTEXT_QUESTIONS[0]!.id]: preset.defaultContext } : {},
    objectivesText: preset.defaultObjectives?.join("\n") ?? "",
    triggerType: (preset.defaultTriggerType as TriggerType) ?? "manual",
    cron: preset.defaultCron ?? base.cron,
    tools: [...preset.workTools],
  };
}

export function NewAgentWizard({ project }: { project: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const create = useCreateAgent(project);
  const roles = TEMPLATES;

  // A showcase link (/signup?template=x) arrives with the role already chosen.
  const preselected = roles.find((role) => role.id === search.get("template"));
  const [template, setTemplate] = React.useState<string | null>(preselected?.id ?? null);
  const [step, setStep] = React.useState(preselected ? 1 : 0);
  const [form, setForm] = React.useState<HireForm>(() => formFrom(preselected));
  const [scope, setScope] = React.useState<ScopeFormState>(() => scopeFrom(preselected));
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  const preset = template && template !== SCRATCH ? templateById(template) : undefined;
  const dutyOptions = preset ? [...preset.responsibilities, ...preset.moreResponsibilities] : [];
  const set = <K extends keyof HireForm>(key: K, value: HireForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const ready = Boolean(form.name.trim() && form.jobTitle.trim());

  // Picking a role is the whole first step: it moves straight on.
  function pick(id: string) {
    const next = id === SCRATCH ? undefined : templateById(id);
    setTemplate(id);
    setForm((current) => ({ ...formFrom(next, current.name.trim() ? current.name : undefined), avatarUrl: current.avatarUrl }));
    setScope(scopeFrom(next));
    setStep(1);
  }

  async function hire() {
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const agent = await create.mutateAsync({
        name: form.name.trim(),
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        ...(preset ? { templateId: preset.id, personality: preset.personality } : {}),
        avatarUrl: form.avatarUrl ?? "",
        responsibilities: form.responsibilities,
        allowedTools: Array.from(new Set([...(preset?.allowedTools ?? ["log_issue", "log_suggestion", "escalate_to_human"]), CHAT_TOOL])) as ToolId[],
        escalationRule: form.escalationRule.trim(),
        status: "draft",
      });
      try {
        await api(`/api/agents/${agent.id}/scope`, {
          method: "PUT",
          body: JSON.stringify({
            contextAnswers: scope.contextAnswers,
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
        // The agent exists; its page shows the same settings to finish there.
        setError(`${errorMessage(caught)} ${form.name} was created - finish the rest on their page.`);
        router.push(`/p/${project}/agents/${agent.id}?onboarding=1`);
        return;
      }
      router.push(`/p/${project}/agents/${agent.id}?onboarding=1`);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Breadcrumbs
          items={[
            { label: "Roster", href: `/p/${project}/roster` },
            { label: "Add an assistant" },
          ]}
          className="mb-4"
        />
        <h1 className="text-xl font-bold tracking-tight text-ink">Add an assistant</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {step === 0
            ? "Pick what you want help with. Everything after that is filled in for you - change what you like."
            : "Filled in from the role. Tick, untick or add - then it's ready to try."}
        </p>

        <Panel className="mt-5">
          <PanelHeader>
            <div>
              <PanelTitle>{step === 0 ? ("What should they help with?") : "Make it yours"}</PanelTitle>
              <PanelDescription>
                {step === 0 ? `Step 1 of 2` : `Step 2 of 2${preset ? ` · ${preset.name}` : " · from scratch"}`}
              </PanelDescription>
            </div>
          </PanelHeader>

          <PanelBody className="space-y-6">
            <FormError message={error} />

            {step === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((role) => (
                  <TemplateCard
                    key={role.id}
                    selected={template === role.id}
                    onSelect={() => pick(role.id)}
                    icon={<TemplateIcon icon={role.icon} className="size-5" />}
                    title={role.name}
                    subtitle={role.jobTitle}
                    body={role.pitch}
                  />
                ))}
                <TemplateCard
                  selected={template === SCRATCH}
                  onSelect={() => pick(SCRATCH)}
                  icon={<ScratchCuteIcon className="size-5" />}
                  title="Start from scratch"
                  subtitle="Your own role"
                  body="Name the job and tick what it looks after. Best when none of the roles is close."
                />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Name"
                    htmlFor="name"
                    required
                    error={fieldErrors.name?.[0]}
                    action={
                      <Button type="button" variant="secondary" onClick={() => set("name", randomAgentName())} title="Pick another name">
                        <Shuffle aria-hidden />
                        <span className="sr-only">Pick another name</span>
                      </Button>
                    }
                  >
                    <Input id="name" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Bright" />
                  </Field>
                  <Field label={copy.roleLabel} htmlFor="jobTitle" required error={fieldErrors.jobTitle?.[0]}>
                    <Input
                      id="jobTitle"
                      value={form.jobTitle}
                      autoFocus={!preset}
                      onChange={(event) => set("jobTitle", event.target.value)}
                      placeholder={copy.rolePlaceholder}
                    />
                  </Field>
                </div>

                <details className="rounded-md border border-line">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2/60">
                    Face <span className="font-normal text-ink-muted">· optional</span>
                  </summary>
                  <div className="space-y-4 border-t border-line p-3">
                    <div className="space-y-1.5">
                      <Label>Face</Label>
                      <AvatarPicker
                        key={form.avatarUrl ?? `auto:${form.name}`}
                        name={form.name}
                        value={form.avatarUrl}
                        onChange={(next) => set("avatarUrl", next)}
                      />
                    </div>
                  </div>
                </details>

                <ResponsibilitiesPicker
                  value={form.responsibilities}
                  onChange={(next) => set("responsibilities", next)}
                  options={dutyOptions}
                  idPrefix="hire"
                />

                <EscalationPicker value={form.escalationRule} onChange={(next) => set("escalationRule", next)} idPrefix="hire" />

                <ObjectivesSection
                  value={scope}
                  onChange={setScope}
                  fieldErrors={fieldErrors}
                  idPrefix="hire"
                  project={project}
                  role={{ jobTitle: form.jobTitle, responsibilities: form.responsibilities }}
                />

                <TriggerSection value={scope} onChange={setScope} fieldErrors={fieldErrors} idPrefix="hire" />

                <ToolsSection value={scope} onChange={setScope} idPrefix="hire" roleTools={preset?.workTools} project={project} />

                <details className="rounded-md border border-line">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2/60">
                    More about the work <span className="font-normal text-ink-muted">· optional, helps it get things right</span>
                  </summary>
                  <div className="border-t border-line p-3">
                    <ContextSection
                      value={scope}
                      onChange={setScope}
                      fieldErrors={fieldErrors}
                      idPrefix="hire"
                      heading={false}
                      inherited={<InheritedProjectContext project={project} />}
                    />
                  </div>
                </details>
              </>
            )}
          </PanelBody>

          {step === 1 ? (
            <PanelFooter>
              <Button variant="ghost" onClick={() => setStep(0)} className="mr-auto">
                <ArrowLeft aria-hidden />
                Other roles
              </Button>
              <Button onClick={() => void hire()} loading={saving} disabled={!ready}>
                Add {form.name.trim() || "them"}
                <ArrowRight aria-hidden />
              </Button>
            </PanelFooter>
          ) : null}
        </Panel>
      </div>
    </div>
  );
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
        "flex items-start gap-3 rounded-lg border p-3 text-left transition",
        selected ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition",
          selected ? "bg-accent text-accent-fg" : "bg-surface-2 text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{subtitle}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{body}</span>
      </span>
    </button>
  );
}
