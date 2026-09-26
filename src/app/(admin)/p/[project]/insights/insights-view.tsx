"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Clock,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  InsightCollaborationIcon,
  InsightTasksRunIcon,
  InsightTelemetryEmptyIcon,
  InsightTimeSavedIcon,
  InsightCostIcon,
} from "@/components/icons/insights-icons";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingKpis, LoadingRows } from "@/components/ui/states";
import { useAnalytics } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";
import {
  costCaption,
  formatHours,
  humanDuration,
  tasksCaption,
  timeSaved,
} from "@/lib/insight-copy";

function money(value: number | null): string {
  if (value === null) return "—";
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

export function InsightsView({ project }: { project: string }) {
  const [days, setDays] = React.useState("30");
  const { data, isPending, error, refetch, isRefetching } = useAnalytics(project, Number(days));

  const saved = React.useMemo(() => {
    if (!data) return { hours: 0, caption: "" };
    return timeSaved(data.totals.conversations, data.work.totals.done);
  }, [data]);

  const totalTokens = React.useMemo(() => {
    if (!data) return 0;
    return data.work.totals.inputTokens + data.work.totals.outputTokens;
  }, [data]);

  return (
    <Page>
      <PageHeader
        title="Insights"
        description="Executive summary of your autonomous AI workforce: time saved, tasks done on their own, multi-agent collaboration, and what it cost."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/p/${project}/insights/detailed`} className="inline-flex items-center gap-1.5">
              Detailed Insights
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <PageToolbar>
        <p className="text-sm text-ink-muted">
          Autonomous execution and resource metrics for the active workspace.
        </p>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`/p/${project}/insights/detailed`} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
              Detailed breakdown
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          </Button>
          <div className="w-40">
            <label htmlFor="range" className="sr-only">
              Time range
            </label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageToolbar>

      <PageBody className="space-y-6">
        {isPending ? (
          <>
            <LoadingKpis />
            <LoadingRows count={3} />
          </>
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : data!.work.totals.runs === 0 && totalTokens === 0 ? (
          <EmptyState
            icon={InsightTelemetryEmptyIcon}
            title="Nothing to measure yet"
            description="Insights populate once your published agents run autonomous tasks on a schedule, trigger workflows, or collaborate with each other."
            action={
              <Button asChild variant="secondary">
                <Link href={`/p/${project}/roster`}>Go to the roster</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Primary KPI Grid: Time Saved, Tasks on Own, Agent Collaboration, Cost */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. Time Saved - the headline: the number that says whether this was worth it */}
              <Panel className="flex flex-col p-5 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Hours saved for your team</p>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-positive-line/70 bg-positive-soft text-positive shadow-2xs">
                    <InsightTimeSavedIcon className="size-4.5" />
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <p className="text-display font-bold leading-none tracking-tight text-ink tabular-nums">
                    {formatHours(saved.hours)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    <Clock className="size-3 text-ink-subtle" aria-hidden />
                    <span>Decision turnaround: {humanDuration(data!.work.totals.approvalTurnaroundMs)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {saved.caption}
                  </p>
                </div>
              </Panel>

              {/* 2. Tasks Done on Their Own */}
              <Panel className="flex flex-col p-5 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Tasks done on their own</p>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent-line/70 bg-accent-soft text-accent-soft-fg shadow-2xs">
                    <InsightTasksRunIcon className="size-4.5" />
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <p className="text-display font-bold leading-none tracking-tight text-ink tabular-nums">
                    {data!.work.totals.runs.toLocaleString()}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span className="text-positive font-medium">{data!.work.totals.done} finished</span>
                    <span>·</span>
                    <span className={data!.work.totals.failed > 0 ? "text-danger" : ""}>{data!.work.totals.failed} stopped</span>
                    <span>·</span>
                    <span>{data!.work.totals.awaiting} waiting</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {tasksCaption({
                      runs: data!.work.totals.runs,
                      previousRuns: data!.previous.runs,
                      done: data!.work.totals.done,
                      failed: data!.work.totals.failed,
                      awaiting: data!.work.totals.awaiting,
                      days: data!.days,
                    })}
                  </p>
                </div>
              </Panel>

              {/* 3. Collaboration Between Agents */}
              <Panel className="flex flex-col p-5 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Collaboration between agents</p>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent-line/70 bg-accent-soft text-accent-soft-fg shadow-2xs">
                    <InsightCollaborationIcon className="size-4.5" />
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <p className="text-display font-bold leading-none tracking-tight text-ink tabular-nums">
                    {data!.collab.total.toLocaleString()}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{data!.collab.delegations} task handoffs</span>
                    <span>·</span>
                    <span>{data!.collab.transfers} chat transfers</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    Autonomous tasks and client inquiries routed between specialized team members.
                  </p>
                </div>
              </Panel>

              {/* 4. Estimated cost - deliberately quieter than the three above: what it
                  cost matters, but it is not the headline. Raw tokens are the fine print. */}
              <Panel className="flex flex-col p-5 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Estimated cost</p>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-muted shadow-2xs">
                    <InsightCostIcon className="size-4.5" />
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <p className="text-xl font-semibold leading-none tracking-tight text-ink tabular-nums">
                    {money(data!.work.totals.costUsd)}
                  </p>
                  <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
                    {costCaption({
                      costUsd: data!.work.totals.costUsd,
                      runs: data!.work.totals.runs,
                      conversations: data!.totals.conversations,
                      unpricedModels: data!.work.totals.unpricedModels,
                      days: data!.days,
                    })}
                  </p>
                  <p className="mt-2 font-mono text-xs text-ink-subtle tabular-nums">
                    {totalTokens.toLocaleString()} tokens · {data!.work.totals.inputTokens.toLocaleString()} in /{" "}
                    {data!.work.totals.outputTokens.toLocaleString()} out
                  </p>
                </div>
              </Panel>
            </div>

            {/* Collaboration Between Agents Section */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Collaboration between agents</PanelTitle>
                  <PanelDescription>
                    Work handed off between specialized roles: research delegated to analysts, copy requests to marketers, and customer transfers.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.collab.handoffs.length === 0 ? (
                  <EmptyState
                    icon={InsightCollaborationIcon}
                    title="No agent collaborations recorded in this window"
                    description="When an agent uses delegate_to_colleague during an autonomous run, or transfers a client conversation to a specialist on your roster, their teamwork is logged here."
                    className="py-8"
                  />
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {data!.collab.handoffs.map((handoff) => (
                      <li key={handoff.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <AgentAvatar
                              name={handoff.fromAgent.name}
                              src={handoff.fromAgent.avatarUrl}
                              seed={handoff.fromAgent.id}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-ink">{handoff.fromAgent.name}</span>
                          </div>

                          <ArrowRightLeft className="size-3.5 text-ink-subtle" aria-hidden />

                          <div className="flex items-center gap-1.5">
                            <AgentAvatar
                              name={handoff.toAgent.name}
                              src={handoff.toAgent.avatarUrl}
                              seed={handoff.toAgent.id}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-ink">{handoff.toAgent.name}</span>
                          </div>

                          <Badge tone={handoff.type === "delegation" ? "accent" : "neutral"} className="ml-1 text-[11px]">
                            {handoff.type === "delegation" ? "Delegated task" : "Transferred chat"}
                          </Badge>
                        </div>

                        <div className="min-w-0 flex-1 px-2 sm:max-w-md">
                          <p className="truncate text-xs text-ink">{handoff.summary}</p>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <StatusBadge status={handoff.status} />
                          <span className="meta text-xs">{formatRelativeTime(handoff.createdAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            {/* What each agent did on its own */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>What each agent did on its own</PanelTitle>
                  <PanelDescription>
                    Autonomous work in the last {days} days. Includes task counts, completion states, tokens used, and approval turnaround.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.work.agents.length === 0 ? (
                  <EmptyState
                    icon={InsightTelemetryEmptyIcon}
                    title="No autonomous work yet"
                    description="Give an agent a scope of work with a schedule, webhook, or initiate a run to see independent activity here."
                    className="py-8"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[50rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="pb-2 pr-3 meta font-medium">Agent</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Tasks</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Finished</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Stopped</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Waiting on you</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">You decide in</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Tokens used</th>
                          <th scope="col" className="pb-2 pl-3 meta font-medium text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data!.work.agents.map((agent) => {
                          const agentTokens = agent.inputTokens + agent.outputTokens;
                          return (
                            <tr key={agent.id} className="transition-colors hover:bg-surface-2/60">
                              <td className="py-2.5 pr-3">
                                <Link
                                  href={`/p/${project}/agents/${agent.id}`}
                                  className="flex items-center gap-2.5 hover:underline"
                                >
                                  <AgentAvatar
                                    name={agent.name}
                                    src={agent.avatarUrl}
                                    seed={agent.id}
                                    size="sm"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-ink">{agent.name}</span>
                                    <span className="block truncate text-xs text-ink-muted">{agent.jobTitle}</span>
                                  </span>
                                </Link>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">{agent.runs}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-positive">{agent.done}</td>
                              <td className={`py-2.5 px-3 text-right tabular-nums ${agent.failed > 0 ? "text-danger" : ""}`}>
                                {agent.failed}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">{agent.awaiting}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">
                                {humanDuration(agent.approvalTurnaroundMs)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted font-mono text-xs">
                                {agentTokens.toLocaleString()}
                              </td>
                              <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-ink">
                                {money(agent.costUsd)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </PanelBody>
            </Panel>

            {/* Gateway Card to Detailed Insights */}
            <Panel className="border-accent-line/60 bg-accent-soft/30 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-accent" aria-hidden />
                    <h3 className="text-sm font-semibold text-ink">Need deeper diagnostics?</h3>
                  </div>
                  <p className="text-xs text-ink-muted max-w-xl">
                    Explore document retrieval hit rates, questions your documents cannot answer (content gaps), unhelpful client reply ratings, and model pricing telemetry.
                  </p>
                </div>
                <Button asChild variant="primary" size="sm" className="shrink-0">
                  <Link href={`/p/${project}/insights/detailed`} className="inline-flex items-center gap-1.5">
                    View Detailed Insights
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </Panel>
          </>
        )}
      </PageBody>
    </Page>
  );
}
