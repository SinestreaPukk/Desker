"use client";

import * as React from "react";
import Link from "next/link";
import { Play, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { FormError, Skeleton } from "@/components/ui/states";
import { useDocuments } from "@/hooks/use-admin-data";
import { useActionItems, useRunScope, useSaveScope, useScope } from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/api-client";
import { describeCadence } from "@/lib/work/cadence";
import { STATUS_LABELS, type ActionStatus } from "@/lib/work/types";
import type { ScopeDto } from "@/lib/work/scope";
import { formatRelativeTime } from "@/lib/utils";
import {
  ScopeOfWorkForm,
  TrustSettings,
  browserTimezone,
  parseObjectives,
  type ScopeFormState,
} from "./scope-of-work-form";

function toForm(scope: ScopeDto): ScopeFormState {
  return {
    context: scope.context,
    objectivesText: scope.objectives.join("\n"),
    documentIds: scope.documentIds,
    triggerType: scope.triggerType,
    cron: scope.cron ?? "0 9 * * 1",
    timezone: scope.timezone === "UTC" && !scope.cron ? browserTimezone() : scope.timezone,
    enabled: scope.enabled,
    autonomy: scope.autonomy,
    toolAutonomy: scope.toolAutonomy ?? {},
  };
}

const STATUS_TONE: Record<ActionStatus, "neutral" | "accent" | "positive" | "warning" | "danger"> = {
  queued: "neutral",
  in_progress: "accent",
  needs_approval: "warning",
  approved: "accent",
  executing_external: "accent",
  done: "positive",
  failed: "danger",
  rejected: "neutral",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

/** Loads the scope, then hands a fully-known initial state to the editor below. */
export function ScopeOfWorkPanel({ agentId, project }: { agentId: string; project: string }) {
  const scope = useScope(agentId);
  if (!scope.data) {
    return (
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Scope of work</PanelTitle>
            <PanelDescription>
              What this agent does on its own, and when.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {scope.error ? <FormError message={errorMessage(scope.error)} /> : null}
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </PanelBody>
      </Panel>
    );
  }
  return <ScopeEditor key={agentId} agentId={agentId} project={project} scope={scope.data} />;
}

function ScopeEditor({
  agentId,
  project,
  scope,
}: {
  agentId: string;
  project: string;
  scope: ScopeDto;
}) {
  const documents = useDocuments(agentId);
  const save = useSaveScope(agentId);
  const run = useRunScope(agentId);
  const recent = useActionItems({ project, agentId }, { refetchInterval: 5_000 });

  const [form, setForm] = React.useState<ScopeFormState>(() => toForm(scope));
  const [saved, setSaved] = React.useState<ScopeFormState>(() => toForm(scope));
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [runNote, setRunNote] = React.useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function onSave() {
    setError(null);
    setFieldErrors({});
    try {
      const result = await save.mutateAsync({
        context: form.context.trim(),
        objectives: parseObjectives(form.objectivesText),
        documentIds: form.documentIds,
        triggerType: form.triggerType,
        cron: form.triggerType === "cron" ? form.cron : null,
        timezone: form.timezone.trim() || "UTC",
        enabled: form.enabled,
        autonomy: form.autonomy,
        toolAutonomy: Object.keys(form.toolAutonomy).length > 0 ? form.toolAutonomy : null,
      });
      const next = toForm(result);
      setForm(next);
      setSaved(next);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError(errorMessage(caught));
      }
    }
  }

  async function onRun() {
    setRunNote(null);
    try {
      const item = await run.mutateAsync();
      setRunNote(
        item.error
          ? `The run could not start: ${item.error}`
          : "Run started. Progress shows below and under Work.",
      );
    } catch (caught) {
      setRunNote(errorMessage(caught));
    }
  }

  const webhookUrl =
    scope.webhookToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/hooks/${scope.webhookToken}`
      : null;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Scope of work</PanelTitle>
          <PanelDescription>
            What this agent does on its own, and when. Runs happen in the background whether
            or not anyone is signed in.
          </PanelDescription>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-5">
        <FormError message={error} />
        <ScopeOfWorkForm
          value={form}
          onChange={setForm}
          documents={(documents.data ?? [])
            .filter((doc) => doc.status === "ready")
            .map((doc) => ({ id: doc.id, filename: doc.filename }))}
          fieldErrors={fieldErrors}
          webhookUrl={webhookUrl}
          showModeNote={false}
        />

        <div className="border-t border-line pt-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" aria-hidden />
            <h3 className="text-[0.8125rem] font-medium text-ink">Trust</h3>
          </div>
          <TrustSettings
            value={{ autonomy: form.autonomy, toolAutonomy: form.toolAutonomy }}
            onChange={(next) => setForm({ ...form, ...next })}
          />
        </div>

        {scope.triggerType === "cron" && scope.nextFireAt ? (
          <p className="text-xs text-ink-muted">
            {describeCadence(scope.cron, scope.timezone)}. Next run{" "}
            {formatRelativeTime(scope.nextFireAt)}
            {scope.lastFiredAt ? `; last fired ${formatRelativeTime(scope.lastFiredAt)}` : ""}.
          </p>
        ) : null}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[0.8125rem] font-medium text-ink">Recent runs</h3>
            <Link
              href={`/p/${project}/work?agentId=${agentId}`}
              className="text-xs text-accent hover:underline"
            >
              All work
            </Link>
          </div>
          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {recent.data.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem]">
                  <div className="min-w-0">
                    <span className="text-ink">
                      {item.trigger === "schedule"
                        ? "Scheduled run"
                        : item.trigger === "webhook"
                          ? "Webhook run"
                          : item.trigger === "followup"
                            ? "Follow-up"
                            : "Manual run"}
                    </span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                    {item.summary ? (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{item.summary}</p>
                    ) : item.error ? (
                      <p className="mt-0.5 truncate text-xs text-danger">{item.error}</p>
                    ) : null}
                  </div>
                  <ActionStatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">
              No runs yet. Save a scope of work, then run it once by hand to see what it does.
            </p>
          )}
          {runNote ? <p className="mt-2 text-xs text-ink-muted">{runNote}</p> : null}
        </div>
      </PanelBody>

      <PanelFooter className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRun}
          disabled={run.isPending || dirty}
          title={dirty ? "Save first" : undefined}
        >
          <Play aria-hidden />
          {run.isPending ? "Starting…" : "Run now"}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={!dirty || save.isPending}>
          <Save aria-hidden />
          {save.isPending ? "Saving…" : "Save scope"}
        </Button>
      </PanelFooter>
    </Panel>
  );
}
