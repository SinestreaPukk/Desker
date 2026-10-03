"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { MEMORY_FIELDS } from "@/lib/agents/memory-fields";
import { errorMessage } from "@/lib/shared/api-client";
import { formatRelativeTime } from "@/lib/shared/utils";

/** Everything it has picked up about you, and when. Fix anything that is wrong. */
export function MemoryTab({ project }: { project: string }) {
  const context = useProjectContext(project);
  const save = useSaveProjectContext(project);
  // Only what the person changed; the rest follows the server, so new things show up here on their own.
  const [edits, setEdits] = React.useState<Record<string, string>>({});

  if (context.isPending) return <Skeleton className="h-64" />;
  if (context.error || !context.data) return <ErrorState message={errorMessage(context.error)} onRetry={() => void context.refetch()} />;

  const { answers, learnedAt } = context.data;
  const known = MEMORY_FIELDS.filter((field) => (answers[field.id] ?? "").trim() || field.id in edits);
  const latest = Object.values(learnedAt).sort().at(-1);
  const dirty = Object.keys(edits).length > 0;

  async function onSave() {
    try {
      await save.mutateAsync({ ...answers, ...edits });
      setEdits({});
      toast.success("Saved");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-ink-muted">
        {latest ? `Last learned ${formatRelativeTime(latest)}. ` : ""}It adds to this as you talk. Fix anything that is wrong.
      </p>

      {known.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
          <p className="font-medium text-ink">Nothing yet</p>
          <p className="mt-1 text-sm text-ink-muted">Chat with it and what it learns about you shows up here.</p>
        </div>
      ) : (
        known.map((field) => (
          <Field
            key={field.id}
            label={field.label}
            htmlFor={`memory-${field.id}`}
            aside={
              <span className="text-xs text-ink-muted">
                {learnedAt[field.id] ? `Learned ${formatRelativeTime(learnedAt[field.id]!)}` : "You wrote this"}
              </span>
            }
          >
            <Textarea
              value={edits[field.id] ?? answers[field.id] ?? ""}
              onChange={(event) => setEdits((current) => ({ ...current, [field.id]: event.target.value }))}
              rows={3}
              className="min-h-20"
            />
          </Field>
        ))
      )}

      {dirty ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => void onSave()} loading={save.isPending} className="shadow-md">
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
