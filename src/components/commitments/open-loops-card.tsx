"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/shared/api-client";
import type { CommitmentDto } from "@/lib/commitments/types";

/**
 * Open Loops Card in the Rail:
 * Per Design.md's Rail-Never-Acts Rule, this is SUMMARY ONLY.
 * No action buttons or mutations inside the rail.
 */
export function OpenLoopsRailCard({ project }: { project: string }) {
  const query = useQuery({
    queryKey: ["project-commitments", project, "active"],
    queryFn: () => api<{ commitments: CommitmentDto[] }>(`/api/projects/${project}/commitments?status=active`),
    refetchInterval: 30_000,
  });

  const commitments = query.data?.commitments ?? [];
  const waitingOn = commitments.filter((c) => c.type === "waiting_on");
  const todos = commitments.filter((c) => c.type === "to_do");
  const recurring = commitments.filter((c) => c.type === "recurring");

  if (commitments.length === 0) return null;

  return (
    <div className="mx-1 my-3 rounded-lg border border-line/60 bg-surface/70 p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Clock className="size-3.5 text-accent" aria-hidden />
          Open Loops
        </span>
        <Badge tone="accent" className="h-5 px-1.5 text-meta">
          {commitments.length}
        </Badge>
      </div>

      <div className="mt-2 space-y-1 text-meta text-ink-muted">
        {waitingOn.length > 0 ? (
          <p>
            <span className="font-semibold text-ink">{waitingOn.length}</span> waiting on others
          </p>
        ) : null}
        {todos.length > 0 ? (
          <p>
            <span className="font-semibold text-ink">{todos.length}</span> to-do
          </p>
        ) : null}
        {recurring.length > 0 ? (
          <p>
            <span className="font-semibold text-ink">{recurring.length}</span> recurring
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Open Loops in the Chat Thread:
 * This is where actions happen through chips (Done, Not yet, Drop).
 */
export function OpenLoopsThreadCard({
  project,
  commitments: initialCommitments,
}: {
  project: string;
  commitments?: CommitmentDto[];
}) {
  const client = useQueryClient();
  const queryKey = ["project-commitments", project, "active"];

  const query = useQuery({
    queryKey,
    queryFn: () => api<{ commitments: CommitmentDto[] }>(`/api/projects/${project}/commitments?status=active`),
    initialData: initialCommitments ? { commitments: initialCommitments } : undefined,
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "done" | "dropped" }) =>
      api<{ commitment: CommitmentDto }>(`/api/projects/${project}/commitments/${id}/close`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, variables) => {
      toast.success(variables.status === "done" ? "Commitment completed." : "Commitment dropped.");
      void client.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data?.commitments ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface p-4 text-center">
        <p className="text-sm text-ink-muted">No open loops or commitments right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-line/80 bg-surface p-4 shadow-xs sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">What you are tracking ({items.length})</h3>
        <Badge tone="accent">Open loops</Badge>
      </div>

      <div className="divide-y divide-line/60">
        {items.map((item) => (
          <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{item.outcome}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-meta text-ink-muted">
                  {item.type === "waiting_on" ? (
                    <span className="inline-flex items-center gap-1 text-accent font-medium">
                      <User className="size-3" aria-hidden />
                      Waiting on {item.ownerName || "someone"}
                    </span>
                  ) : item.type === "recurring" ? (
                    <span className="text-warning font-medium">Recurring</span>
                  ) : (
                    <span>To-do</span>
                  )}
                  {item.dueAt ? (
                    <span>• Due {new Date(item.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Action Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate({ id: item.id, status: "done" })}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-positive hover:bg-positive-soft pointer-coarse:min-h-11"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => toast("Kept open.")}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink pointer-coarse:min-h-11"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate({ id: item.id, status: "dropped" })}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft pointer-coarse:min-h-11"
              >
                Drop
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
