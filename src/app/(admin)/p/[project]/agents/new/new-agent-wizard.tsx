"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ApiError, errorMessage } from "@/lib/api-client";
import { parseLines } from "@/lib/agent-fields";
import { TOOL_IDS, TOOL_METADATA, type ToolId } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";

/**
 * Starting points, not templates to maintain: each one just pre-fills the form
 * so a first-time admin is editing prose rather than facing an empty textarea.
 */
const STARTERS = [
  {
    id: "support",
    label: "Customer support",
    name: "Mia",
    jobTitle: "Customer Support Lead",
    department: "Customer Experience",
    personality:
      "Warm but efficient. Answers in two or three sentences, never uses corporate filler, and says plainly when something isn't possible rather than hedging. Takes a reported problem seriously the first time it is mentioned.",
    responsibilities:
      "Answer questions about orders, shipping and returns\nHelp clients find the right product\nCollect enough detail on a bug for engineering to reproduce it\nRecord feature requests clients raise",
    escalationRule:
      "Escalate if the client is angry or upset, asks for a refund over $200, mentions legal action, or asks for something that needs a manager's approval.",
    welcomeMessage:
      "Hi, I'm Mia. Ask me anything about your order, a return, or how something works.",
  },
  {
    id: "onboarding",
    label: "Client onboarding",
    name: "Ravi",
    jobTitle: "Onboarding Specialist",
    department: "Customer Success",
    personality:
      "Patient and methodical. Explains one step at a time and checks the client is with you before moving on. Never assumes technical knowledge, never talks down.",
    responsibilities:
      "Walk new clients through setup, one step at a time\nAnswer questions about plans, limits and configuration\nFlag anything that blocks a client from getting started",
    escalationRule:
      "Escalate if the client is blocked by something you cannot fix, asks about custom contract terms, or has been stuck on the same step twice.",
    welcomeMessage:
      "Welcome aboard. I'm Ravi — I'll get you set up. What would you like to start with?",
  },
  {
    id: "blank",
    label: "Start from scratch",
    name: "",
    jobTitle: "",
    department: "",
    personality: "",
    responsibilities: "",
    escalationRule: "",
    welcomeMessage: "",
  },
] as const;

const STEPS = ["Who they are", "How they work", "What they can do"] as const;

export function NewAgentWizard({ project }: { project: string }) {
  const router = useRouter();
  const create = useCreateAgent(project);

  const [step, setStep] = React.useState(0);
  const [starter, setStarter] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [form, setForm] = React.useState({
    name: "",
    jobTitle: "",
    department: "",
    personality: "",
    responsibilitiesText: "",
    escalationRule: "",
    welcomeMessage: "",
    allowedTools: [...TOOL_IDS] as ToolId[],
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function applyStarter(id: string) {
    const preset = STARTERS.find((entry) => entry.id === id);
    if (!preset) return;
    setStarter(id);
    setForm((current) => ({
      ...current,
      name: preset.name,
      jobTitle: preset.jobTitle,
      department: preset.department,
      personality: preset.personality,
      responsibilitiesText: preset.responsibilities,
      escalationRule: preset.escalationRule,
      welcomeMessage: preset.welcomeMessage,
    }));
  }

  const stepValid = [
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
        personality: form.personality.trim(),
        responsibilities: parseLines(form.responsibilitiesText),
        allowedTools: form.allowedTools,
        escalationRule: form.escalationRule.trim(),
        welcomeMessage: form.welcomeMessage.trim(),
        status: "draft",
      });
      router.push(`/p/${project}/agents/${agent.id}?onboarding=1`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
        // Send the admin back to the step that owns the bad field.
        const fields = Object.keys(caught.fieldErrors ?? {});
        if (fields.some((field) => ["name", "jobTitle"].includes(field))) setStep(0);
        else if (fields.includes("personality")) setStep(1);
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

        <h1 className="text-2xl font-semibold text-ink">Hire an AI employee</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Three short steps, then you&apos;ll add a document and publish. About five
          minutes end to end.
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
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
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
                    "Give them a name and a job. Clients see both.",
                    "Describe how they behave and what falls to them.",
                    "Pick the actions they may take on a client's behalf.",
                  ][step]
                }
              </PanelDescription>
            </div>
          </PanelHeader>

          <PanelBody className="space-y-5">
            <FormError message={error} />

            {step === 0 ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="text-[0.8125rem] font-medium text-ink">
                    Start from
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {STARTERS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={starter === preset.id}
                        onClick={() => applyStarter(preset.id)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          starter === preset.id
                            ? "border-accent bg-accent-soft"
                            : "border-line hover:bg-surface-2",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink">
                          {preset.id !== "blank" ? (
                            <Sparkles className="size-3.5 text-accent" aria-hidden />
                          ) : null}
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

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
              </>
            ) : null}

            {step === 1 ? (
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
              </>
            ) : null}

            {step === 2 ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="sr-only">Permitted actions</legend>
                  {TOOL_IDS.map((tool) => {
                    const meta = TOOL_METADATA[tool];
                    const checked = form.allowedTools.includes(tool);
                    return (
                      <label
                        key={tool}
                        htmlFor={`new-tool-${tool}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                          checked
                            ? "border-accent-line bg-accent-soft/40"
                            : "border-line hover:bg-surface-2",
                        )}
                      >
                        <Checkbox
                          id={`new-tool-${tool}`}
                          checked={checked}
                          onCheckedChange={(next) =>
                            set(
                              "allowedTools",
                              next
                                ? [...form.allowedTools, tool]
                                : form.allowedTools.filter((item) => item !== tool),
                            )
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-[0.8125rem] font-medium text-ink">
                            {meta.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                            {meta.blurb}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <Field
                  label="Escalation rule"
                  htmlFor="escalationRule"
                  hint="When should this agent stop and fetch a human? Plain language."
                >
                  <Textarea
                    value={form.escalationRule}
                    rows={3}
                    disabled={!form.allowedTools.includes("escalate_to_human")}
                    onChange={(event) => set("escalationRule", event.target.value)}
                    placeholder="Escalate if the client is angry or asks for a refund over $200."
                  />
                </Field>
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
