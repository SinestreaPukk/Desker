"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleDashed, Play, TriangleAlert, Workflow as WorkflowIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Page, PageBody, PageHeader } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, FormError, LoadingRows } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/shared/api-client";
import type { WorkflowRunView } from "@/lib/work/workflow-run";
import type { StepState } from "@/lib/work/workflows";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/shared/utils";

interface WorkflowDef {
  id: string;
  name: string;
  pitch: string;
  input: { label: string; placeholder: string; optional?: boolean };
  gate: string;
  steps: { title: string; roleLabel: string; suggestedAgentId: string | null }[];
}
interface AgentRef {
  id: string;
  name: string;
  jobTitle: string;
  avatarUrl: string | null;
}
interface WorkflowsResponse {
  workflows: WorkflowDef[];
  agents: AgentRef[];
  runs: WorkflowRunView[];
}

const STATE: Record<StepState, { label: (agent: string) => string; tone: string; Icon: React.ComponentType<{ className?: string }> }> = {
  not_started: { label: () => "Not started", tone: "text-ink-subtle", Icon: CircleDashed },
  with_agent: { label: (agent) => `With ${agent}`, tone: "text-accent", Icon: CircleDashed },
  needs_you: { label: () => "In Needs you", tone: "text-warning", Icon: TriangleAlert },
  done: { label: () => "Done", tone: "text-positive", Icon: Check },
  failed: { label: () => "Failed", tone: "text-danger", Icon: TriangleAlert },
  stopped: { label: () => "Stopped", tone: "text-ink-muted", Icon: CircleDashed },
};

/**
 * A few named multi-agent workflows, started on purpose and followed end to
 * end: who owns each step, and whether the work is with an agent, waiting in
 * Needs you, or done. Not a builder - the sequences are fixed, so what gets
 * used (and rejected) shows which hand-offs matter.
 */
export function WorkflowsView({ project }: { project: string }) {
  const data = useQuery({
    queryKey: ["workflows", project],
    queryFn: () => api<WorkflowsResponse>(`/api/workflows?project=${encodeURIComponent(project)}`),
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => run.steps.some((step) => step.state === "with_agent")) ? 5_000 : 30_000,
  });

  return (
    <Page>
      <PageHeader
        title="Workflows"
        description="Work that passes between agents, started on purpose. Each step has an owner, and you can see exactly where it is: with an agent, waiting in Needs you, or done."
      />
      <PageBody className="space-y-10">
        {data.isPending ? (
          <LoadingRows count={3} />
        ) : data.error ? (
          <ErrorState message={errorMessage(data.error)} onRetry={() => void data.refetch()} />
        ) : (
          <>
            <section aria-labelledby="start-heading" className="space-y-3">
              <h2 id="start-heading" className="text-sm font-semibold text-ink">
                Start one
              </h2>
              {data.data.workflows.length === 0 ? (
                <EmptyState icon={WorkflowIcon} title="No workflows for this space yet" description="" />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {data.data.workflows.map((workflow) => (
                    <StartCard key={workflow.id} workflow={workflow} agents={data.data.agents} project={project} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="recent-heading" className="space-y-3">
              <h2 id="recent-heading" className="text-sm font-semibold text-ink">
                Recent
              </h2>
              {data.data.runs.length === 0 ? (
                <EmptyState
                  icon={WorkflowIcon}
                  title="Nothing started yet"
                  description="Start a workflow above and follow it here, step by step."
                />
              ) : (
                <div className="space-y-3">
                  {data.data.runs.map((run) => (
                    <RunCard key={run.rootId} run={run} project={project} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </PageBody>
    </Page>
  );
}

function StartCard({ workflow, agents, project }: { workflow: WorkflowDef; agents: AgentRef[]; project: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const [input, setInput] = React.useState("");
  const [chosen, setChosen] = React.useState<(string | null)[]>(() => workflow.steps.map((step) => step.suggestedAgentId));
  const [error, setError] = React.useState<string | null>(null);
  const start = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/api/workflows?project=${encodeURIComponent(project)}`, {
        method: "POST",
        body: JSON.stringify({ workflowId: workflow.id, input, agentIds: chosen }),
      }),
    onSettled: () => void client.invalidateQueries({ queryKey: ["workflows", project] }),
  });
  const ready = chosen.every(Boolean) && (workflow.input.optional || input.trim().length > 0);

  return (
    <Panel className="flex flex-col p-5">
      <h3 className="text-base font-semibold text-ink">{workflow.name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{workflow.pitch}</p>

      <ol className="mt-4 space-y-2">
        {workflow.steps.map((step, index) => (
          <li key={step.title} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-ink">{step.title}</span>
            <div className="w-full sm:w-60">
              <label htmlFor={`${workflow.id}-${index}`} className="sr-only">
                Who does step {index + 1}
              </label>
              <Select
                value={chosen[index] ?? undefined}
                onValueChange={(value) => setChosen((current) => current.map((id, i) => (i === index ? value : id)))}
              >
                <SelectTrigger id={`${workflow.id}-${index}`} className="[&>span]:truncate">
                  <SelectValue placeholder={`Choose a ${step.roleLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} · {agent.jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </li>
        ))}
        <li className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Check className="size-3.5" aria-hidden />
          </span>
          {workflow.gate}, in Needs you
        </li>
      </ol>

      <div className="mt-4 space-y-3">
        <FormError message={error} />
        <Field label={workflow.input.label} htmlFor={`${workflow.id}-input`} hint={workflow.input.optional ? "Optional." : undefined}>
          <Textarea
            id={`${workflow.id}-input`}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={workflow.input.placeholder}
          />
        </Field>
        {agents.length === 0 ? (
          <p className="text-xs text-ink-muted">Publish the agents it needs first, then start it here.</p>
        ) : !ready ? (
          <p className="text-xs text-ink-muted" aria-live="polite">
            {!chosen.every(Boolean) ? "Choose who does each step" : `Fill in "${workflow.input.label}"`} to start.
          </p>
        ) : null}
        <Button
          size="sm"
          disabled={!ready}
          loading={start.isPending}
          onClick={async () => {
            setError(null);
            try {
              const run = await start.mutateAsync();
              toast.success(`${workflow.name} started`, { description: "Follow it below; each step starts when the one before finishes." });
              setInput("");
              router.push(`/p/${project}/workflows#${run.id}`);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          }}
        >
          <Play aria-hidden />
          Start
        </Button>
      </div>
    </Panel>
  );
}

function RunCard({ run, project }: { run: WorkflowRunView; project: string }) {
  const done = run.steps.every((step) => step.state === "done");
  return (
    <Panel id={run.rootId} className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">
            {run.name}
            {done ? (
              <Badge tone="positive" className="ml-2 align-middle">
                Finished
              </Badge>
            ) : null}
          </h3>
          {run.input ? <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{run.input}</p> : null}
        </div>
        <span className="text-xs text-ink-muted" title={formatDateTime(run.startedAt)}>
          Started {formatRelativeTime(run.startedAt)}
        </span>
      </div>
      <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {run.steps.map((step, index) => {
          const view = STATE[step.state];
          const current = index === run.current && !done;
          const href =
            step.state === "needs_you" && step.runId
              ? `/p/${project}/needs-you?item=${step.runId}`
              : step.runId
                ? `/p/${project}/work/${step.runId}`
                : null;
          const body = (
            <>
              <span className="flex items-center gap-2">
                {step.agent ? <AgentAvatar name={step.agent.name} src={step.agent.avatarUrl} seed={step.agent.id} size="sm" /> : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{step.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{step.agent?.name ?? step.roleLabel}</span>
                </span>
              </span>
              <span className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", view.tone)}>
                <view.Icon className={cn("size-3.5", step.state === "with_agent" && "motion-safe:animate-spin")} />
                {view.label(step.agent?.name ?? "the agent")}
              </span>
            </>
          );
          return (
            <React.Fragment key={step.title}>
              {index > 0 ? <ArrowRight className="hidden size-4 shrink-0 self-center text-ink-subtle sm:block" aria-hidden /> : null}
              <li
                className={cn(
                  "min-w-0 flex-1 rounded-lg border p-3",
                  current ? "border-accent-line bg-accent-soft/30" : "border-line bg-surface",
                )}
                aria-current={current ? "step" : undefined}
              >
                {href ? (
                  <Link href={href} className="block hover:opacity-90">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </Panel>
  );
}
