"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useProjectContext } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";
import type { ContextAnswers, ContextQuestion } from "@/lib/work/context";
import { answeredCount } from "@/lib/work/context";

/**
 * Context as a short set of questions rather than one blank box.
 *
 * Each field carries an example in its placeholder - never as real text the
 * owner has to delete first, which is the trap prefilled "starter" copy falls
 * into: it gets left in, and the agent ends up describing somebody else's
 * life.
 */
export function ContextQuestions({
  questions,
  value,
  onChange,
  idPrefix,
  fieldErrors = {},
  disabled = false,
}: {
  questions: readonly ContextQuestion[];
  value: ContextAnswers;
  onChange: (next: ContextAnswers) => void;
  idPrefix: string;
  fieldErrors?: Record<string, string[]>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <Field
          key={question.id}
          label={question.label}
          htmlFor={`${idPrefix}-${question.id}`}
          hint={question.hint}
          error={fieldErrors[question.id]?.[0]}
        >
          <Textarea
            id={`${idPrefix}-${question.id}`}
            value={value[question.id] ?? ""}
            rows={question.rows ?? 3}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, [question.id]: event.target.value })}
            placeholder={question.placeholder}
          />
        </Field>
      ))}
    </div>
  );
}

export interface ContextDraftResult {
  answers: ContextAnswers;
  sources: string[];
}

/**
 * "Draft this from my documents": the agent reads what has been uploaded and
 * proposes answers, which the owner then edits. Editing a draft is a much
 * smaller ask than writing from nothing.
 *
 * It only fills questions that are still empty. Overwriting an answer someone
 * typed - to replace it with a guess from a document - would be the one
 * behaviour that makes this button not worth pressing.
 */
export function ContextDraftButton({
  questions,
  value,
  onChange,
  draft,
  documentCount,
  pending = false,
  label = "Draft this from my documents",
}: {
  questions: readonly ContextQuestion[];
  value: ContextAnswers;
  onChange: (next: ContextAnswers) => void;
  draft: () => Promise<ContextDraftResult>;
  /** Ready documents available to read. Zero explains itself in the tooltip. */
  documentCount: number;
  pending?: boolean;
  label?: string;
}) {
  const [running, setRunning] = React.useState(false);
  const busy = running || pending;

  async function run() {
    setRunning(true);
    try {
      const result = await draft();
      const next = { ...value };
      let filled = 0;
      let skipped = 0;
      for (const question of questions) {
        const proposed = result.answers[question.id]?.trim();
        if (!proposed) continue;
        if (next[question.id]?.trim()) {
          skipped += 1;
          continue;
        }
        next[question.id] = proposed;
        filled += 1;
      }

      if (filled === 0) {
        toast(
          skipped > 0
            ? "Nothing to add - you had already answered everything it found"
            : "Your documents did not say enough to answer these",
          {
            description:
              skipped > 0
                ? "Clear a field first if you would rather have its suggestion."
                : `Read ${result.sources.length || "no"} document${result.sources.length === 1 ? "" : "s"} and found nothing it could answer from. Writing a couple of lines yourself will beat a guess.`,
          },
        );
        return;
      }

      onChange(next);
      toast.success(`Drafted ${filled} of ${questions.length} answers`, {
        description:
          `From ${result.sources.join(", ")}. Read them and edit before saving` +
          (skipped > 0 ? ` - what you had already written was left alone.` : " - they are the agent's standing instructions."),
      });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setRunning(false);
    }
  }

  const unanswered = questions.length - answeredCount(value, questions);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={busy}
      disabled={busy || documentCount === 0 || unanswered === 0}
      onClick={() => void run()}
      title={
        documentCount === 0
          ? "Upload a document first - there is nothing to read yet."
          : unanswered === 0
            ? "Every question is answered. Clear one to get a suggestion for it."
            : undefined
      }
    >
      <Sparkles aria-hidden />
      {busy ? "Reading your documents…" : label}
    </Button>
  );
}

/**
 * What an agent gets for free from its project. Shown above its own answers
 * so nobody types the background about themselves a second time - and so the four
 * questions underneath read as "what is different about this role".
 */
export function InheritedProjectContext({ project }: { project: string }) {
  const context = useProjectContext(project);
  const loaded = context.data;
  if (!loaded) return null;

  if (loaded.answered === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-2/50 px-3 py-2.5 text-xs text-ink-muted">
        <span className="text-ink">Nothing shared yet.</span> Describe yourself once under Knowledge and
        your assistant reads it first - then these questions are only about this work.
      </div>
    );
  }

  return (
    <details className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs">
      <summary className="cursor-pointer text-ink-muted">
        <span className="text-ink">Inherited from this project</span> · {loaded.answered} of{" "}
        {loaded.total} shared answers, read before this agent&apos;s own
      </summary>
      <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-ink-muted">
        {loaded.context}
      </pre>
    </details>
  );
}
