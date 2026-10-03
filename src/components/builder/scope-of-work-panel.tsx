"use client";

import * as React from "react";
import Link from "next/link";
import { GitBranch, ListChecks, Newspaper, Play, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
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
import {
  useActionItems,
  useDraftAgentContext,
  useGenerateDigest,
  useRunScope,
  useSaveScope,
  useScope,
} from "@/hooks/use-work-data";
import { ApiError, errorMessage } from "@/lib/shared/api-client";
import { describeCadence } from "@/lib/work/cadence";
import type { ScopeDto } from "@/lib/work/scope";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/shared/utils";
import { ContextDraftButton, InheritedProjectContext } from "./context-questions";
import { ScopeFlow } from "./scope-flow";
import { HelpLink } from "@/components/help/help-panel";
import { markFlowViewSeen } from "@/components/help/checklist-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shownAgentQuestions } from "@/lib/work/context";
import {
  DigestSettings,
  ScopeOfWorkForm,
  TrustSettings,
  browserTimezone,
  parseObjectives,
  type ScopeFormState,
} from "./scope-of-work-form";
import { WORK_TOOL_IDS } from "@/lib/work/tools";
import { TRIGGER_LABELS } from "@/lib/work/types";

function toForm(scope: ScopeDto): ScopeFormState {
  return {
    contextAnswers: scope.contextAnswers,
    objectivesText: scope.objectives.join("\n"),
    documentIds: scope.documentIds,
    triggerType: scope.triggerType,
    cron: scope.cron ?? "0 9 * * 1",
    timezone: scope.timezone === "UTC" && !scope.cron ? browserTimezone() : scope.timezone,
    enabled: scope.enabled,
    autonomy: scope.autonomy,
    toolAutonomy: scope.toolAutonomy ?? {},
    tools: scope.tools ?? [...WORK_TOOL_IDS],
    digestCadence: scope.digestCadence,
    digestEmail: scope.digestEmail,
    digestRecipients: scope.digestRecipients,
  };
}

/** Loads the scope, then hands a fully-known initial state to the editor below. */
export function ScopeOfWorkPanel({
  agentId,
  project,
  agent = { name: "", jobTitle: "" },
}: {
  agentId: string;
  project: string;
  /** Live from the editor's own fields, so the flow shows what is on screen. */
  agent?: { name: string; jobTitle: string; responsibilities?: string[]; roleTools?: readonly string[] };
}) {
  const scope = useScope(agentId);
  if (!scope.data) {
    return (
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Scope of work</PanelTitle>
            <PanelDescription>What this agent does on its own, and when.</PanelDescription>
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
  return (
    <ScopeEditor
      key={agentId}
      agentId={agentId}
      project={project}
      agent={agent}
      scope={scope.data}
    />
  );
}

function ScopeEditor({
  agentId,
  project,
  agent,
  scope,
}: {
  agent: { name: string; jobTitle: string; responsibilities?: string[]; roleTools?: readonly string[] };
  agentId: string;
  project: string;
  scope: ScopeDto;
}) {
  const documents = useDocuments(agentId);
  const draftContext = useDraftAgentContext(agentId);
  const save = useSaveScope(agentId);
  const run = useRunScope(agentId);
  const digestNow = useGenerateDigest(agentId);
  const recent = useActionItems({ project, agentId }, { refetchInterval: 5_000 });

  const [form, setForm] = React.useState<ScopeFormState>(() => toForm(scope));
  const [saved, setSaved] = React.useState<ScopeFormState>(() => toForm(scope));
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [runNote, setRunNote] = React.useState<string | null>(null);
  // Form is the default for every agent, every time: the picture is for
  // owners who want the bird's-eye once they have a few tools wired up, not
  // the way the configuration is meant to be read first.
  const [view, setView] = React.useState<"form" | "flow">("form");

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function onSave() {
    setError(null);
    setFieldErrors({});
    try {
      const result = await save.mutateAsync({
        context: "",
        contextAnswers: form.contextAnswers,
        objectives: parseObjectives(form.objectivesText),
        documentIds: form.documentIds,
        triggerType: form.triggerType,
        cron: form.triggerType === "cron" ? form.cron : null,
        timezone: form.timezone.trim() || "UTC",
        enabled: form.enabled,
        autonomy: form.autonomy,
        toolAutonomy: Object.keys(form.toolAutonomy).length > 0 ? form.toolAutonomy : null,
        tools: form.tools,
        digestCadence: form.digestCadence,
        digestEmail: form.digestEmail,
        digestRecipients: form.digestRecipients,
      });
      const next = toForm(result);
      setForm(next);
      setSaved(next);
      toast.success("Scope of work saved", {
        description:
          result.triggerType === "cron"
            ? `Runs ${describeCadence(result.cron, result.timezone).toLowerCase()}.`
            : result.triggerType === "webhook"
              ? "Runs whenever the webhook receives an event."
              : "Runs only when you press Run now.",
      });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError(errorMessage(caught));
      }
    }
  }

  async function onDigestNow() {
    try {
      await digestNow.mutateAsync();
      toast.success("Writing the team check-in", {
        description:
          "It covers the agents in this project since the last check-in and appears under Work → Check-ins shortly.",
      });
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  async function onRun() {
    setRunNote(null);
    try {
      const item = await run.mutateAsync();
      if (item.error) {
        setRunNote(`The run could not start: ${item.error}`);
        toast.error("The run could not start", { description: item.error });
      } else {
        setRunNote("Run started. Progress shows below and under Work.");
        toast.success("Run started", {
          description: "Progress shows in Recent runs and under Work.",
        });
      }
    } catch (caught) {
      setRunNote(errorMessage(caught));
      toast.error(errorMessage(caught));
    }
  }

  const readyDocuments = (documents.data ?? [])
    .filter((doc) => doc.status === "ready")
    .map((doc) => ({ id: doc.id, filename: doc.filename }));

  const webhookUrl =
    scope.webhookToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/hooks/${scope.webhookToken}`
      : null;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Work &amp; schedule</PanelTitle>
          <PanelDescription>
            When this agent works on its own and what it works on. Runs happen in the background
            whether or not anyone is signed in.
          </PanelDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <HelpLink topic="flowView" label="What is the flow view?" />
          <Tabs
            value={view}
            onValueChange={(next) => {
              setView(next as typeof view);
              // One of the four setting-up steps is seeing this once.
              if (next === "flow") markFlowViewSeen();
            }}
          >
            <TabsList aria-label="How to view the scope of work">
              <TabsTrigger value="form">
                <ListChecks aria-hidden />
                Form
              </TabsTrigger>
              <TabsTrigger value="flow">
                <GitBranch aria-hidden />
                Flow
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-5">
        <FormError message={error} />

        {view === "flow" ? (
          <ScopeFlow
            value={form}
            onChange={setForm}
            agent={agent}
            fieldErrors={fieldErrors}
            webhookUrl={webhookUrl}
            documents={readyDocuments}
          />
        ) : (
          <>
            <ScopeOfWorkForm
              value={form}
              onChange={setForm}
              documents={readyDocuments}
              fieldErrors={fieldErrors}
              webhookUrl={webhookUrl}
              showModeNote={false}
              contextDraft={
                <ContextDraftButton
                  questions={shownAgentQuestions(form.contextAnswers)}
                  value={form.contextAnswers}
                  onChange={(contextAnswers) => setForm({ ...form, contextAnswers })}
                  draft={() => draftContext.mutateAsync()}
                  documentCount={readyDocuments.length}
                />
              }
              inherited={<InheritedProjectContext project={project} />}
              project={project}
              roleTools={agent.roleTools}
              role={{ jobTitle: agent.jobTitle, responsibilities: agent.responsibilities ?? [] }}
            />

            <div className="border-t border-line pt-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" aria-hidden />
                <h3 className="text-sm font-medium text-ink">Trust</h3>
              </div>
              <TrustSettings
                value={{
                  autonomy: form.autonomy,
                  toolAutonomy: form.toolAutonomy,
                }}
                onChange={(next) => setForm({ ...form, ...next })}
              />
            </div>

            <div className="border-t border-line pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="size-4 text-accent" aria-hidden />
                  <h3 className="text-sm font-medium text-ink">Team check-in</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={digestNow.isPending}
                  onClick={() => void onDigestNow()}
                >
                  Send a check-in now
                </Button>
              </div>
              <DigestSettings
                value={{
                  digestCadence: form.digestCadence,
                  digestEmail: form.digestEmail,
                  digestRecipients: form.digestRecipients,
                }}
                onChange={(next) => setForm({ ...form, ...next })}
              />
            </div>
          </>
        )}

        {scope.triggerType === "cron" && scope.nextFireAt ? (
          <p className="text-xs text-ink-muted">
            {describeCadence(scope.cron, scope.timezone)}. Next run{" "}
            {formatDateTime(scope.nextFireAt)} ({formatRelativeTime(scope.nextFireAt)})
            {scope.lastFiredAt ? `; last fired ${formatDateTime(scope.lastFiredAt)}` : ""}.
          </p>
        ) : null}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">Recent runs</h3>
          </div>
          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {recent.data.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-ink">
                      {TRIGGER_LABELS[item.trigger] ?? "Manual"} run
                    </span>
                    <span className="ml-2 text-xs text-ink-muted" title={formatDateTime(item.createdAt)}>
                      {formatTime(item.createdAt)} · {formatRelativeTime(item.createdAt)}
                    </span>
                    {(item.headline ?? item.summary) ? (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {item.headline ?? item.summary}
                      </p>
                    ) : item.error ? (
                      <p className="mt-0.5 truncate text-xs text-danger">{item.error}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={item.status} />
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
