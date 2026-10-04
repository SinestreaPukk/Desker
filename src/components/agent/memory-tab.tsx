"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Plus, Edit2, Check, X, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/shared/api-client";
import { formatRelativeTime } from "@/lib/shared/utils";
import type { MemoryRecordDto, MemoryKind } from "@/lib/memory/types";

const KIND_LABELS: Record<MemoryKind, string> = {
  preference: "Preference",
  person: "Person",
  routine: "Routine",
  standing_instruction: "Instruction",
  fact: "Fact",
};

const KIND_TONES: Record<MemoryKind, "neutral" | "accent" | "positive" | "warning"> = {
  preference: "accent",
  person: "positive",
  routine: "warning",
  standing_instruction: "accent",
  fact: "neutral",
};

export function MemoryTab({ project }: { project: string }) {
  const client = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [filterKind, setFilterKind] = React.useState<string>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftFact, setDraftFact] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [newFact, setNewFact] = React.useState("");
  const [newKind, setNewKind] = React.useState<MemoryKind>("fact");
  const [newPerson, setNewPerson] = React.useState("");

  const queryKey = ["project-memories", project];
  const memoriesQuery = useQuery({
    queryKey,
    queryFn: () => api<{ memories: MemoryRecordDto[] }>(`/api/projects/${project}/memories`),
  });

  const addMutation = useMutation({
    mutationFn: (data: { fact: string; kind: MemoryKind; personName?: string }) =>
      api<{ memory: MemoryRecordDto; message: string }>(`/api/projects/${project}/memories`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast.success(data.message || "Memory saved.");
      setNewFact("");
      setNewPerson("");
      setShowAdd(false);
      void client.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MemoryRecordDto> }) =>
      api<{ memory: MemoryRecordDto }>(`/api/projects/${project}/memories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Memory updated.");
      setEditingId(null);
      void client.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/projects/${project}/memories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Memory forgotten.");
      void client.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (memoriesQuery.isPending) return <Skeleton className="h-64" aria-busy aria-label="Loading memories" />;
  if (memoriesQuery.error || !memoriesQuery.data) {
    return <ErrorState message={errorMessage(memoriesQuery.error)} onRetry={() => void memoriesQuery.refetch()} />;
  }

  const memories = memoriesQuery.data.memories ?? [];
  const needle = query.trim().toLowerCase();

  const filtered = memories.filter((m) => {
    if (filterKind !== "all" && m.kind !== filterKind) return false;
    if (!needle) return true;
    return (
      m.fact.toLowerCase().includes(needle) ||
      (m.person?.name && m.person.name.toLowerCase().includes(needle)) ||
      m.kind.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search what it knows about you..."
            aria-label="Search memory"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="size-4" aria-hidden />
            Add memory
          </Button>
        </div>
      </div>

      {/* Add Memory Form (Bubble Card) */}
      {showAdd ? (
        <div className="rounded-panel border border-accent-line/60 bg-surface p-4 shadow-xs sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Remember a new fact</h3>
          <div className="space-y-3">
            <Textarea
              placeholder="e.g. No meetings on Wednesday afternoons"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              rows={2}
              className="min-h-16"
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                Kind:
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as MemoryKind)}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="routine">Routine</option>
                  <option value="standing_instruction">Instruction</option>
                  <option value="person">Person</option>
                </select>
              </label>

              {newKind === "person" ? (
                <Input
                  placeholder="Person name (e.g. Mom)"
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
              ) : null}

              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  disabled={!newFact.trim() || addMutation.isPending}
                  loading={addMutation.isPending}
                  onClick={() =>
                    addMutation.mutate({
                      fact: newFact.trim(),
                      kind: newKind,
                      personName: newPerson.trim() || undefined,
                    })
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilterKind("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            filterKind === "all" ? "bg-accent text-accent-fg" : "bg-surface-2 text-ink-muted hover:text-ink"
          }`}
        >
          All ({memories.length})
        </button>
        {(["preference", "person", "routine", "standing_instruction", "fact"] as const).map((k) => {
          const count = memories.filter((m) => m.kind === k).length;
          if (count === 0 && filterKind !== k) return null;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKind(k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filterKind === k ? "bg-accent text-accent-fg" : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {KIND_LABELS[k]} ({count})
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line px-4 py-12 text-center bg-surface">
          <p className="font-hand text-xl text-ink">
            {needle || filterKind !== "all" ? "No matching memories" : "Nothing remembered yet"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {needle || filterKind !== "all"
              ? "Try changing your search or filter."
              : "Chat with your assistant or save preferences here. What it learns stays visible and editable."}
          </p>
        </div>
      ) : null}

      {/* Memory List (Bubble Cards & Rail Items) */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isEditing = editingId === item.id;
          const isPending = item.status === "pending_confirmation";

          return (
            <div
              key={item.id}
              className={`rounded-panel border bg-surface p-4 shadow-xs transition-colors ${
                isPending ? "border-warning-line bg-warning-soft/20" : "border-line/70"
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={draftFact}
                    onChange={(e) => setDraftFact(e.target.value)}
                    rows={2}
                    className="min-h-16"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!draftFact.trim() || updateMutation.isPending}
                      loading={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: item.id, data: { fact: draftFact.trim() } })}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_TONES[item.kind]}>{KIND_LABELS[item.kind]}</Badge>
                      {item.person ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                          <User className="size-3" aria-hidden />
                          {item.person.name}
                          {item.person.relationship ? ` (${item.person.relationship})` : ""}
                        </span>
                      ) : null}
                      {item.source === "inferred" ? (
                        <span className="text-meta text-ink-muted">(inferred)</span>
                      ) : null}
                    </div>

                    <p className="text-sm leading-relaxed text-ink font-medium">{item.fact}</p>

                    <div className="flex flex-wrap items-center gap-3 text-meta text-ink-muted">
                      <span>Saved {formatRelativeTime(item.createdAt)}</span>
                      {item.lastUsedAt ? <span>• Used {formatRelativeTime(item.lastUsedAt)}</span> : null}
                    </div>
                  </div>

                  {/* Actions / Confirmation */}
                  <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                    {isPending ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-xs"
                          onClick={() => updateMutation.mutate({ id: item.id, data: { status: "confirmed" } })}
                        >
                          <Check className="size-3 text-positive mr-1" aria-hidden />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-danger"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <X className="size-3 mr-1" aria-hidden />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          aria-label={`Edit ${item.fact}`}
                          onClick={() => {
                            setDraftFact(item.fact);
                            setEditingId(item.id);
                          }}
                        >
                          <Edit2 className="size-3.5" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:inline text-xs">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-ink-muted hover:text-danger"
                          aria-label={`Forget ${item.fact}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:inline text-xs">Forget</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
