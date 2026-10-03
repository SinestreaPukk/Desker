"use client";

import * as React from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { changeLine, memoryItems, type MemoryItem } from "@/lib/agents/memory-items";
import { errorMessage } from "@/lib/shared/api-client";
import { formatRelativeTime } from "@/lib/shared/utils";

/** What it knows about you, one fact per line. Edit a line, or forget it. */
export function MemoryTab({ project }: { project: string }) {
  const context = useProjectContext(project);
  const save = useSaveProjectContext(project);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<{ fieldId: string; index: number } | null>(null);
  const [draft, setDraft] = React.useState("");

  if (context.isPending) return <Skeleton className="h-64" aria-busy aria-label="Loading" />;
  if (context.error || !context.data) return <ErrorState message={errorMessage(context.error)} onRetry={() => void context.refetch()} />;

  const { answers, learnedAt } = context.data;
  const items = memoryItems(answers);
  const needle = query.trim().toLowerCase();
  const shown = needle ? items.filter((item) => item.text.toLowerCase().includes(needle) || item.label.toLowerCase().includes(needle)) : items;
  const groups = [...new Set(shown.map((item) => item.fieldId))].map((fieldId) => ({
    fieldId,
    label: shown.find((item) => item.fieldId === fieldId)!.label,
    items: shown.filter((item) => item.fieldId === fieldId),
  }));

  async function write(fieldId: string, text: string) {
    await save.mutateAsync({ ...answers, [fieldId]: text });
  }

  async function forget(item: MemoryItem) {
    const before = answers[item.fieldId] ?? "";
    try {
      await write(item.fieldId, changeLine(before, item.index, null));
      toast("Forgotten", {
        action: {
          label: "Undo",
          onClick: () => void write(item.fieldId, before).catch((caught) => toast.error(errorMessage(caught))),
        },
      });
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  async function commit(item: MemoryItem) {
    const text = draft.trim();
    if (!text) return;
    try {
      await write(item.fieldId, changeLine(answers[item.fieldId] ?? "", item.index, text));
      setEditing(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center">
        <p className="font-hand text-xl text-ink">Nothing yet</p>
        <p className="mt-1 text-sm text-ink-muted">Chat with it and what it learns about you is listed here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search what it knows" aria-label="Search memory" className="pl-9" />
        </div>
        <p className="shrink-0 text-sm text-ink-muted">{items.length} {items.length === 1 ? "thing" : "things"}</p>
      </div>

      {groups.length === 0 ? <p className="text-sm text-ink-muted">Nothing matches.</p> : null}

      {groups.map((group) => (
        <section key={group.fieldId} aria-label={group.label}>
          <h2 className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
            {group.label}
            {learnedAt[group.fieldId] ? <span className="text-xs font-normal text-ink-muted">Learned {formatRelativeTime(learnedAt[group.fieldId]!)}</span> : null}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {group.items.map((item) => {
              const isEditing = editing?.fieldId === item.fieldId && editing.index === item.index;
              return (
                <li key={`${item.fieldId}-${item.index}`} className="flex items-start gap-3 px-4 py-3">
                  {isEditing ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <Textarea
                        value={draft}
                        autoFocus
                        rows={2}
                        className="min-h-16"
                        aria-label="Edit this"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditing(null);
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void commit(item);
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void commit(item)} loading={save.isPending} disabled={!draft.trim()}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left leading-relaxed text-ink hover:text-accent pointer-coarse:py-2"
                        title="Click to edit"
                        onClick={() => {
                          setDraft(item.text);
                          setEditing({ fieldId: item.fieldId, index: item.index });
                        }}
                      >
                        {item.text}
                      </button>
                      <Button variant="ghost" size="sm" aria-label={`Forget: ${item.text}`} disabled={save.isPending} onClick={() => void forget(item)}>
                        <Trash2 aria-hidden />
                        Forget
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
