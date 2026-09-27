"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { CollabTag, RunDetail, runTitle } from "@/components/work/run-detail";
import { CancelRunButton, RemoveButton } from "@/components/work/row-actions";
import { useActionItem, useSuggestions } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import { TRIGGER_LABELS } from "@/lib/work/types";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

/** One run on its own page, so the Work list can stay a list. */
export function RunView({ project, itemId }: { project: string; itemId: string }) {
  const run = useActionItem(itemId);
  const suggestions = useSuggestions({ project });
  const item = run.data;
  const router = useRouter();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <Breadcrumbs
          items={[{ label: "Work", href: `/p/${project}/work` }, { label: item ? item.agent.name : "Run" }]}
          className="mb-3"
        />
        {item ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full ring-1 ring-line/80">
                <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="md" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-ink">{runTitle(item)}</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  {item.agent.name}
                  {item.agent.jobTitle ? `, ${item.agent.jobTitle}` : ""} · {TRIGGER_LABELS[item.trigger] ?? item.trigger} ·{" "}
                  <span title={formatDateTime(item.createdAt)}>
                    {formatDateTime(item.createdAt)} ({formatRelativeTime(item.createdAt)})
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CollabTag item={item} />
              {item.escalatedAt ? <Badge tone="danger">Escalated</Badge> : null}
              <StatusBadge status={item.status} />
              {item.status === "queued" || item.status === "in_progress" ? <CancelRunButton id={item.id} /> : null}
              {["in_progress", "approved", "executing_external"].includes(item.status) ? null : (
                <RemoveButton
                  targets={[{ kind: "run", id: item.id }]}
                  what="this run"
                  onRemoved={() => router.push(`/p/${project}/work`)}
                />
              )}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {run.isPending ? (
          <LoadingRows count={4} />
        ) : run.error ? (
          <ErrorState message={errorMessage(run.error)} onRetry={() => void run.refetch()} />
        ) : item ? (
          <RunDetail
            item={item}
            project={project}
            suggestions={(suggestions.data ?? []).filter((suggestion) => suggestion.actionItemId === item.id)}
          />
        ) : null}
      </div>
    </div>
  );
}
