"use client";

import * as React from "react";
import { Check, ChevronRight, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelFooter } from "@/components/ui/panel";
import { FormError, Skeleton } from "@/components/ui/states";
import {
  useDraftProjectContext,
  useProjectContext,
  useSaveProjectContext,
} from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/shared/api-client";
import { cn } from "@/lib/shared/utils";
import { answeredCount, contextQuestions, type ContextAnswers } from "@/lib/work/context";
import type { ProjectContextDto } from "@/lib/work/project-context";
import { ContextDraftButton, ContextQuestions } from "./context-questions";

/**
 * About you, typed once.
 *
 * Every agent in the project reads these answers before its own, so hiring a
 * third agent is not a third round of describing yourself. It sits at the
 * top of the roster - the page an owner is on when they hire - and opens by
 * itself while it is still empty, because an owner who never finds it writes
 * the same paragraph three times instead.
 */
export function ProjectContextPanel({
  project,
  initialOpen = false,
  embedded = false,
}: {
  project: string;
  initialOpen?: boolean;
  /** Inside the agent editor: always open, no collapse header. */
  embedded?: boolean;
}) {
  const context = useProjectContext(project);

  if (context.isPending) return <Skeleton className="mb-4 h-16" />;
  // Quiet, but never silent: one line and a retry, so a failure here does not
  // read as "this project has no shared context".
  if (context.error || !context.data) {
    return (
      <Panel className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-ink-muted">
          Your shared context could not be loaded just now.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void context.refetch()}>
          Try again
        </Button>
      </Panel>
    );
  }

  // Keyed on the project so switching project re-initialises the editor from
  // what was loaded, instead of carrying the last one's answers across.
  return (
    <ContextEditor
      key={context.data.projectId}
      project={project}
      loaded={context.data}
      initialOpen={initialOpen || embedded}
      embedded={embedded}
    />
  );
}

function ContextEditor({
  project,
  loaded,
  initialOpen = false,
  embedded = false,
}: {
  project: string;
  loaded: ProjectContextDto;
  initialOpen?: boolean;
  embedded?: boolean;
}) {
  const save = useSaveProjectContext(project);
  const draft = useDraftProjectContext(project);
  const questions = contextQuestions();
  const subject = "about you";

  const [answers, setAnswers] = React.useState<ContextAnswers>(() => loaded.answers);
  // Default open state; when inside the agent builder's About you section,
  // it opens automatically.
  const [open, setOpen] = React.useState(initialOpen);
  const panel = React.useRef<HTMLDivElement>(null);
  // Asked for from elsewhere on the page (the setup checklist): open it, even
  // when the panel was already on screen, closed - then bring it into view.
  const [askedOpen, setAskedOpen] = React.useState(initialOpen);
  if (initialOpen !== askedOpen) {
    setAskedOpen(initialOpen);
    if (initialOpen) setOpen(true);
  }
  React.useEffect(() => {
    if (initialOpen && !embedded) panel.current?.scrollIntoView({ block: "start" });
  }, [initialOpen, embedded]);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  // The assistant updates these as you talk to it: show what it learned, unless you are mid-edit.
  const shown = React.useRef(loaded.answers);
  React.useEffect(() => {
    const before = shown.current;
    shown.current = loaded.answers;
    if (JSON.stringify(before) !== JSON.stringify(loaded.answers)) {
      setAnswers((current) => (JSON.stringify(current) === JSON.stringify(before) ? loaded.answers : current));
    }
  }, [loaded.answers]);

  const value = answers;
  const dirty = JSON.stringify(value) !== JSON.stringify(loaded.answers);

  async function onSave() {
    setError(null);
    setFieldErrors({});
    try {
      await save.mutateAsync(value);
      toast.success("Shared context saved", {
        description: "Every assistant reads it before its own brief, from the next run on.",
      });
      if (!embedded) setOpen(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError(errorMessage(caught));
      }
    }
  }

  return (
    <Panel ref={panel} className={cn("scroll-mt-4 overflow-hidden", !embedded && "mb-4")}>
      {embedded ? (
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <ContextHeading
            description="What your assistant knows about you. It updates this as you talk to it, and you can correct anything here."
          />
          <ContextBadge loaded={loaded} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2/60"
        >
          <ContextHeading
            description={
              loaded.answered === 0
                ? `Questions ${subject}, read by every assistant here.`
                : `Questions ${subject} · ${loaded.answered} of ${loaded.total} answered.`
            }
          />
          <ContextBadge loaded={loaded} />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors group-hover:text-accent-hover">
            {open ? "Close" : "Edit"}
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-accent transition-transform duration-200",
                open && "rotate-90",
              )}
              aria-hidden
            />
          </span>
        </button>
      )}

      {open ? (
        <>
          <PanelBody className="space-y-4 border-t border-line">
            <FormError message={error} />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-xl text-xs text-ink-muted">
                Every assistant in your space reads these before it does anything. They stay in this space and are never shared.
              </p>
              <ContextDraftButton
                questions={questions.all}
                value={value}
                onChange={setAnswers}
                draft={() => draft.mutateAsync()}
                documentCount={loaded.documentCount}
              />
            </div>
            <ContextQuestions
              questions={questions.core}
              value={value}
              onChange={setAnswers}
              idPrefix="project-context"
              fieldErrors={fieldErrors}
            />
            <details
              className="group rounded-lg border border-line"
              open={answeredCount(value, questions.extra) > 0}
            >
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2/60">
                <span>
                  More about you{" "}
                  <span className="font-normal text-ink-muted">
                    · optional · {answeredCount(value, questions.extra)} of{" "}
                    {questions.extra.length} answered
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-ink-subtle transition-transform duration-200 group-open:rotate-90"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-line p-4">
                <ContextQuestions
                  questions={questions.extra}
                  value={value}
                  onChange={setAnswers}
                  idPrefix="project-context"
                  fieldErrors={fieldErrors}
                />
              </div>
            </details>
          </PanelBody>
          <PanelFooter className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {loaded.documentCount > 0
                ? `${loaded.documentCount} processed document${loaded.documentCount === 1 ? "" : "s"} in this project can be read for a draft.`
                : "Upload a document to an agent and this can be drafted from it."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAnswers(loaded.answers);
                  if (!embedded) setOpen(false);
                }}
                disabled={save.isPending || (embedded && !dirty)}
              >
                {embedded ? "Discard" : "Cancel"}
              </Button>
              <Button size="sm" onClick={() => void onSave()} disabled={!dirty || save.isPending}>
                <Save aria-hidden />
                {save.isPending ? "Saving…" : "Save shared context"}
              </Button>
            </div>
          </PanelFooter>
        </>
      ) : null}
    </Panel>
  );
}

function ContextBadge({ loaded }: { loaded: ProjectContextDto }) {
  if (loaded.answered === loaded.total) {
    return (
      <Badge tone="positive">
        <Check aria-hidden />
        Complete
      </Badge>
    );
  }
  if (loaded.answered > 0) {
    return (
      <Badge tone="neutral">
        {loaded.answered}/{loaded.total}
      </Badge>
    );
  }
  return <Badge tone="accent">Start here</Badge>;
}

function ContextHeading({ description }: { description: string }) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent-line/60 bg-accent-soft/60 text-accent-soft-fg [&_svg]:size-5"
      >
        <UserRound />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold tracking-tight text-ink">About you</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
    </>
  );
}
