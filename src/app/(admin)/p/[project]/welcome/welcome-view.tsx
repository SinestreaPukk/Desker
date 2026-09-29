"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelFooter } from "@/components/ui/panel";
import { FormError, Skeleton } from "@/components/ui/states";
import { ContextQuestions } from "@/components/builder/context-questions";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/api-client";
import { answeredCount, contextQuestionsFor, type ContextAnswers } from "@/lib/work/context";
import { useSpaceKind } from "@/components/space-kind";

/**
 * The first thing a new space does: describe the business - or, in a personal
 * space, the person - once. Every agent hired afterwards starts from these
 * answers, so this sits between signing up and hiring rather than in a panel
 * someone might never open.
 */
export function WelcomeView({ project, template }: { project: string; template: string | null }) {
  const context = useProjectContext(project);
  if (!context.data) {
    return (
      <Shell>
        {context.error ? <FormError message={errorMessage(context.error)} /> : <Skeleton className="h-96" />}
      </Shell>
    );
  }
  return <WelcomeForm project={project} template={template} initial={context.data.answers} />;
}

function WelcomeForm({
  project,
  template,
  initial,
}: {
  project: string;
  template: string | null;
  initial: ContextAnswers;
}) {
  const router = useRouter();
  const kind = useSpaceKind();
  const questions = contextQuestionsFor(kind);
  const save = useSaveProjectContext(project);
  const [answers, setAnswers] = React.useState<ContextAnswers>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const answered = answeredCount(answers, questions.core);
  const total = questions.core.length;

  async function onContinue(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      await save.mutateAsync(answers);
      router.push(`/p/${project}/agents/new${template ? `?template=${encodeURIComponent(template)}` : ""}`);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors ?? {});
    }
  }

  return (
    <Shell>
      <form onSubmit={onContinue}>
        <Panel>
          <PanelBody className="space-y-6 pt-5">
            <FormError message={error} />
            <ContextQuestions
              questions={questions.core}
              value={answers}
              onChange={setAnswers}
              idPrefix="welcome"
              fieldErrors={fieldErrors}
            />
            <details className="rounded-lg border border-line">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2/60">
                {kind === "personal" ? "More about you" : "More about your business"}{" "}
                <span className="font-normal text-ink-muted">· optional, add it any time</span>
              </summary>
              <div className="border-t border-line p-4">
                <ContextQuestions
                  questions={questions.extra}
                  value={answers}
                  onChange={setAnswers}
                  idPrefix="welcome"
                  fieldErrors={fieldErrors}
                />
              </div>
            </details>
          </PanelBody>
          <PanelFooter className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted" aria-live="polite">
              {answered} of {total} answered{answered < total ? " - all four are needed to continue" : ""}
            </p>
            <Button type="submit" disabled={answered < total} loading={save.isPending}>
              {kind === "personal" ? "Choose your first assistant" : "Choose your first agent"}
              <ArrowRight aria-hidden />
            </Button>
          </PanelFooter>
        </Panel>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const kind = useSpaceKind();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <div>
        {kind === "personal" ? (
          <>
            <h1 className="text-xl font-bold tracking-tight text-ink">Tell your assistants about you</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">Step 1 of 2.</span> Four short answers, so every assistant knows who
              it&apos;s helping and how you like things done. Share only what helps: no account numbers, passwords or ID
              numbers are ever needed. This space is private to you, and you can download or delete everything in it
              from Your space.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-tight text-ink">Tell us about your business</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">Step 1 of 2.</span> Four short answers. Every agent you hire reads
              them before it does anything, so it sounds like you and knows who it is working for. Next, you pick your
              first agent from a template that already knows what to do with them.
            </p>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
